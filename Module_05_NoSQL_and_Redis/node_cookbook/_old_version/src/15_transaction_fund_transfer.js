/**
 * 15 · TRANSACTIONS · MULTI, WATCH and Lua on a fund transfer
 * ---------------------------------------------------------------------
 * Use case    Move ₹5,000 from a prepaid wallet to another, inside Redis,
 *             without ever letting the balance go negative.
 * Structure   Two String counters and three different ways to make the
 *             pair of updates safe.
 * Commands    MULTI/EXEC · WATCH · DISCARD · EVAL
 * The point   A Redis transaction is NOT a SQL transaction. It guarantees
 *             that the queued commands run consecutively with nothing
 *             interleaved. It does NOT roll back: if the third command
 *             fails, the first two have still happened.
 * Therefore   Any check that must hold ("is there enough money?") has to be
 *             done with WATCH (optimistic locking) or inside Lua - never by
 *             reading first and hoping.
 * Run         node src/15_transaction_fund_transfer.js
 */
import { main, banner, step, cmd, say, takeaway, connect } from './_client.js';

const A = 'icici:wallet:9003';
const B = 'icici:wallet:9007';

/* ------------------------------------------------------------------ */
/* Attempt 1 - the naive version                                       */
/* ------------------------------------------------------------------ */
async function transferNaive(client, amount) {
  const balance = Number(await client.get(A));
  if (balance < amount) return 'INSUFFICIENT';

  // Another process can debit the wallet in the gap that starts right here.
  await client.multi().decrBy(A, amount).incrBy(B, amount).exec();
  return 'OK';
}

/* ------------------------------------------------------------------ */
/* Attempt 2 - WATCH: optimistic locking                               */
/* WATCH needs its own connection, because the watch is per-connection. */
/* (v4/v5 offered client.executeIsolated(); v6 uses a pool or duplicate.)*/
/* ------------------------------------------------------------------ */
async function transferWatched(client, amount, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const iso = client.duplicate();
    await iso.connect();
    try {
      await iso.watch(A);
      const balance = Number(await iso.get(A));

      if (balance < amount) {
        await iso.unwatch();
        return { result: 'INSUFFICIENT', attempt };
      }

      // If anyone touches A between the WATCH and the EXEC, exec() returns
      // null and nothing was applied - so we simply try again.
      const replies = await iso.multi().decrBy(A, amount).incrBy(B, amount).exec();
      if (replies !== null) return { result: 'OK', attempt };
    } finally {
      await iso.close();
    }
  }
  return { result: 'CONTENDED', attempt: retries };
}

/* ------------------------------------------------------------------ */
/* Attempt 3 - Lua: the check and both updates in one atomic step      */
/* ------------------------------------------------------------------ */
const TRANSFER = `
  local balance = tonumber(redis.call("GET", KEYS[1]) or "0")
  local amount  = tonumber(ARGV[1])
  if balance < amount then
    return {0, balance}
  end
  redis.call("DECRBY", KEYS[1], amount)
  redis.call("INCRBY", KEYS[2], amount)
  return {1, balance - amount}`;

async function transferLua(client, amount) {
  const [ok, balance] = await client.eval(TRANSFER, {
    keys: [A, B],
    arguments: [String(amount)],
  });
  return { ok: ok === 1, balance };
}

/* ------------------------------------------------------------------ */

async function recipe(client) {
  banner('15', 'Transactions', 'Fund transfer with MULTI, WATCH and Lua');
  await client.mSet([A, '10000', B, '2000']);

  step('MULTI queues, EXEC runs the batch with nothing interleaved');
  const replies = await client.multi().get(A).decrBy(A, 1_000).incrBy(B, 1_000).get(B).exec();
  cmd('MULTI … DECRBY … INCRBY … EXEC', JSON.stringify(replies));
  say('One array of replies, in order. No other client saw a half-applied state.');

  step('But MULTI does not roll back');
  await client.set('icici:wallet:bad', 'not-a-number');
  const aBefore = await client.get(A);
  try {
    await client
      .multi()
      .incr(A) // succeeds
      .incr('icici:wallet:bad') // fails at runtime - the value is not an integer
      .incr(B) // still runs
      .exec();
  } catch (err) {
    say(`  the batch reported: ${err.message.split('\n')[0]}`);
  }
  say(`  A before ${aBefore} → after ${await client.get(A)}`);
  say('The failing command did not undo the two that worked. If you expected');
  say('SQL rollback semantics here, this is the moment to stop expecting them.');
  say('Redis validates syntax at queue time; a wrong-type error can only be');
  say('discovered while the batch is already running, and by then it is too late.');
  await client.unlink('icici:wallet:bad');

  step('The naive transfer, and the race hiding inside it');
  await client.mSet([A, '10000', B, '2000']);
  say(`  balance before: A=${await client.get(A)}  B=${await client.get(B)}`);
  say('  GET says 10000, so the transfer proceeds - but between that GET and');
  say('  the EXEC, another server can spend the same money. Both checks pass,');
  say('  both debits apply, and the wallet goes negative.');
  await transferNaive(client, 5_000);
  say(`  balance after : A=${await client.get(A)}  B=${await client.get(B)}`);

  step('WATCH makes the read part of the transaction');
  await client.mSet([A, '10000', B, '2000']);
  const watched = await transferWatched(client, 6_000);
  cmd('WATCH A · GET A · MULTI · DECRBY · INCRBY · EXEC', watched.result);
  say(`  attempt ${watched.attempt}: A=${await client.get(A)}  B=${await client.get(B)}`);
  say('If A had changed after the WATCH, EXEC would have returned null and the');
  say('whole thing would have been retried against the new balance.');

  step('WATCH under contention - a competing write lands mid-transaction');
  await client.mSet([A, '10000', B, '2000']);
  const [outcome] = await Promise.all([
    transferWatched(client, 4_000),
    (async () => {
      const other = await connect();
      await other.decrBy(A, 3_000); // the interfering write
      await other.close();
    })(),
  ]);
  say(`  result ${outcome.result} on attempt ${outcome.attempt}`);
  say(`  A=${await client.get(A)}  B=${await client.get(B)}  (never negative)`);
  say('Optimistic locking: no lock is taken, the loser just retries.');

  step('Lua does the same job in one round trip and cannot be interleaved');
  await client.mSet([A, '10000', B, '2000']);
  const big = await transferLua(client, 99_000);
  cmd('EVAL <transfer> 2 A B 99000', `ok=${big.ok} balance=${big.balance}`);
  say('  refused, and the balance came back with the refusal - no second call.');
  const fine = await transferLua(client, 7_500);
  cmd('EVAL <transfer> 2 A B 7500', `ok=${fine.ok} balance=${fine.balance}`);
  say(`  A=${await client.get(A)}  B=${await client.get(B)}`);

  step('Which one to reach for');
  say('  MULTI  batch unrelated writes that must not interleave.');
  say('  WATCH  read-then-write where conflicts are rare; costs a retry loop.');
  say('  Lua    read-then-write on hot keys; one round trip, no retries, but');
  say('         it blocks the single thread - keep scripts short and loop-free.');

  takeaway(
    'Redis transactions give isolation, not rollback. Put the condition inside '
    + 'WATCH or inside Lua, and never in application code between two calls.',
  );
}

main(recipe);
