/**
 * 14 · STRING + LUA · Distributed lock for the end-of-day batch
 * ---------------------------------------------------------------------
 * Use case    Reconciliation runs at 23:30 on a cluster of six app servers.
 *             Exactly one of them must run it. Twice would double-post.
 * Structure   A String key whose existence IS the lock, plus a Lua script
 *             for the release.
 * Commands    SET key token NX PX · EVAL (compare-and-delete) · PTTL
 * The three   NX      only one caller can create the key
 * parts       PX      the lock expires by itself if the holder dies
 *             token   the release checks ownership, so a slow process
 *                     cannot delete a lock that has since been taken over
 * Why Lua     Release is "read the value, and delete only if it is mine".
 *             Two commands means a gap; a Lua script is one command and
 *             Redis runs it to completion with nothing interleaved.
 * Run         node src/14_lock_eod_batch.js
 */
import { randomUUID } from 'node:crypto';
import { main, banner, step, cmd, say, takeaway, sleep, connect } from './_client.js';

const LOCK = 'icici:lock:eod:2026-09-22';
const TTL_MS = 10_000;

/** Delete the key only if it still holds OUR token. */
const RELEASE = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end`;

/** Extend the lease only if we still hold it - for work that runs long. */
const EXTEND = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
  else
    return 0
  end`;

async function acquire(client, ttlMs = TTL_MS) {
  const token = randomUUID();
  const ok = await client.set(LOCK, token, { NX: true, PX: ttlMs });
  return ok ? token : null;
}

async function release(client, token) {
  return client.eval(RELEASE, { keys: [LOCK], arguments: [token] });
}

async function extend(client, token, ttlMs = TTL_MS) {
  return client.eval(EXTEND, { keys: [LOCK], arguments: [token, String(ttlMs)] });
}

/** One application server trying to run the batch. */
async function server(name, workMs) {
  const client = await connect();
  try {
    const token = await acquire(client);
    if (!token) {
      const holderTtl = await client.pTTL(LOCK);
      say(`  ${name}  did not get the lock - backing off (${holderTtl} ms left on it)`);
      return { name, ran: false };
    }

    say(`  ${name}  HOLDS the lock, token ${token.slice(0, 8)}… - running reconciliation`);
    await sleep(workMs);

    const released = await release(client, token);
    say(`  ${name}  finished, released the lock (script returned ${released})`);
    return { name, ran: true };
  } finally {
    await client.close();
  }
}

async function recipe(client) {
  banner('14', 'String + Lua', 'Distributed lock for the EOD batch');
  await client.unlink(LOCK);

  step('Three servers reach 23:30 at the same instant');
  const results = await Promise.all([
    server('app-01', 400),
    server('app-02', 400),
    server('app-03', 400),
  ]);
  const ranCount = results.filter((r) => r.ran).length;
  cmd(`SET ${LOCK} <uuid> NX PX ${TTL_MS}`, 'OK for one caller, (nil) for the rest');
  say(`servers that ran the batch: ${ranCount}  ← must be exactly 1`);

  step('Why the token matters');
  const mine = await acquire(client, 5_000);
  const theirs = randomUUID();
  cmd('EVAL <release> 1 lock <SOMEONE ELSE\'S token>', await release(client, theirs));
  say('0 - refused. Without the token check, a process that stalled past its');
  say('lease would wake up and delete a lock another server now legitimately');
  say('holds, and then two batches run after all. This is the subtle failure.');
  cmd('EVAL <release> 1 lock <my token>', await release(client, mine));
  say('1 - deleted, because the token matched.');

  step('Work that runs longer than the lease');
  const token = await acquire(client, 2_000);
  say(`  acquired with a 2s lease, PTTL ${await client.pTTL(LOCK)} ms`);
  await sleep(1_000);
  await extend(client, token, 10_000);
  cmd('EVAL <extend> 1 lock <my token> 10000', `PTTL now ${await client.pTTL(LOCK)} ms`);
  say('A watchdog timer that calls this every TTL/3 keeps a long batch safe');
  say('without setting an enormous lease that would strand the lock on a crash.');
  await release(client, token);

  step('Honesty about the limits');
  say('This is correct on a single Redis instance. With replication, a failover');
  say('can lose the lock write and hand the same lock to two servers. If that');
  say('would be a financial incident, use Redlock across independent masters,');
  say('or put the guarantee in PostgreSQL where the transaction already is.');

  takeaway(
    'SET key <random token> NX PX <ttl> to take it, a Lua compare-and-delete '
    + 'to release it. Never DEL a lock without checking the token first.',
  );
}

main(recipe);
