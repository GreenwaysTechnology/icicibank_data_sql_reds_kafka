/**
 * Exercise 7 — lock.js
 * Exactly one server runs the end-of-day batch.
 *
 *   node exercises/ex07_lock.js
 */
import { randomUUID } from 'node:crypto';
import { main, banner, step, cmd, say, takeaway, sleep, connect } from '../src/_client.js';

const LOCK = 'icici:lock:eod';

const RELEASE = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end`;

const EXTEND = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
  else
    return 0
  end`;

export async function acquire(client, ttlMs = 30_000) {
  const token = randomUUID();
  const ok = await client.set(LOCK, token, { NX: true, PX: ttlMs });
  return ok ? token : null;
}

export const release = (client, token) =>
  client.eval(RELEASE, { keys: [LOCK], arguments: [token] });

export const extend = (client, token, ttlMs) =>
  client.eval(EXTEND, { keys: [LOCK], arguments: [token, String(ttlMs)] });

/** One application server reaching 23:30. */
async function server(name, workMs) {
  const client = await connect();
  try {
    const token = await acquire(client, 10_000);
    if (!token) {
      say(`  ${name}  did not get the lock - backing off (${await client.pTTL(LOCK)} ms left on it)`);
      return false;
    }
    say(`  ${name}  HOLDS the lock, token ${token.slice(0, 8)}… - running reconciliation`);
    await sleep(workMs);
    const freed = await release(client, token);
    say(`  ${name}  finished, released the lock (script returned ${freed})`);
    return true;
  } finally {
    await client.close();
  }
}

async function recipe(client) {
  banner('EX07', 'String + Lua', 'Only one server runs the batch');
  await client.unlink(LOCK);

  step('Task 4 · three servers reach 23:30 at the same instant');
  const ran = await Promise.all([server('app-01', 400), server('app-02', 400), server('app-03', 400)]);
  cmd(`SET ${LOCK} <uuid> NX PX 10000`, 'OK for one caller, (nil) for the rest');
  say(`servers that ran the batch: ${ran.filter(Boolean).length}   ← must be exactly 1`);

  step('Task 5 · the token check');
  const mine = await acquire(client, 5_000);
  cmd('EVAL <release> 1 lock <SOMEONE ELSE\'S token>', await release(client, randomUUID()));
  say('0 - refused. Without this check a process that stalled past its lease would');
  say('wake up and delete a lock another server now legitimately holds, and then');
  say('two batches run after all.');
  cmd('EVAL <release> 1 lock <my token>', await release(client, mine));
  say('1 - deleted, because the token matched.');

  step('Task 3 · work that outlives the lease');
  const token = await acquire(client, 2_000);
  say(`  acquired with a 2s lease → PTTL ${await client.pTTL(LOCK)} ms`);
  await sleep(1_000);
  await extend(client, token, 10_000);
  cmd('EVAL <extend> 1 lock <my token> 10000', `PTTL now ${await client.pTTL(LOCK)} ms`);
  say('A watchdog calling this every TTL/3 keeps a long batch safe without an');
  say('enormous lease that would strand the lock if the holder crashed.');
  await release(client, token);

  step('Task 6 · the failure this design still has');
  say('On a replicated Redis a failover can promote a replica that never received');
  say('the lock write, and the lock is handed to a second server. If that would be');
  say('a financial incident: Redlock across independent masters, or keep the');
  say('guarantee in PostgreSQL where the transaction already is.');

  takeaway('NX so one wins · PX so a crash cannot block forever · a token so you '
    + 'can only release your own lock, checked inside Lua.');
}

main(recipe);
