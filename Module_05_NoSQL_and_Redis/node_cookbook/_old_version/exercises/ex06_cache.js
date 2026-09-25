/**
 * Exercise 6 — cache.js
 * Cache-aside over a slow stub, plus both failure modes reproduced and fixed.
 *
 *   node exercises/ex06_cache.js
 *   REDIS_URL=redis://127.0.0.1:6399 node exercises/ex06_cache.js   # fail-open test
 */
import { randomUUID } from 'node:crypto';
import { main, banner, step, cmd, say, takeaway, sleep, reset } from '../src/_client.js';

const TTL = 300;
const key = (acct) => `icici:bal:${acct}`;

/* The stub you were given - every read costs 50 ms. */
const core = {
  rows: { 9001: 118_450.0, 9002: 7_320.55, 9003: 341_244.8 },
  reads: 0,
  async selectBalance(acct) {
    this.reads += 1;
    await sleep(50);
    return this.rows[acct] ?? null;
  },
  async applyDebit(acct, amount) {
    await sleep(50);
    this.rows[acct] -= amount;
    return this.rows[acct];
  },
};

/** invalidate=false reproduces bug 1; jitter=false reproduces bug 2. */
async function getBalance(client, acct, { jitter = true } = {}) {
  const k = key(acct);

  try {
    const hit = await client.get(k);
    if (hit !== null) return { balance: Number(hit), source: 'HIT' };
  } catch {
    // RULE 4 - Redis being down degrades the API, it does not break it.
  }

  const balance = await core.selectBalance(acct);
  if (balance === null) return { balance: null, source: 'MISS' };

  try {
    const spread = jitter ? Math.floor(Math.random() * 60) : 0;
    await client.set(k, String(balance), { EX: TTL + spread });
  } catch {
    /* ignore */
  }
  return { balance, source: 'MISS' };
}

async function postDebit(client, acct, amount, { invalidate = true } = {}) {
  const balance = await core.applyDebit(acct, amount);
  if (invalidate) await client.unlink(key(acct)); // RULES 2 and 3
  return balance;
}

async function hitRate(client) {
  const info = await client.info('stats');
  const n = (name) => Number(info.match(new RegExp(`${name}:(\\d+)`))?.[1] ?? 0);
  const hits = n('keyspace_hits');
  const misses = n('keyspace_misses');
  return (100 * hits) / Math.max(1, hits + misses);
}

async function recipe(client) {
  banner('EX06', 'String + TTL', 'Cache-aside and its two failure modes');
  await reset(client, 'icici:bal:*');

  step('Task 2 · measure it');
  let t = performance.now();
  const cold = await getBalance(client, 9003);
  const coldMs = performance.now() - t;
  t = performance.now();
  for (let i = 0; i < 200; i += 1) await getBalance(client, 9003);
  const warmMs = (performance.now() - t) / 200;
  say(`${cold.source}  cold ${coldMs.toFixed(2)} ms`);
  say(`HIT   warm ${warmMs.toFixed(3)} ms   speed-up ${Math.round(coldMs / warmMs)}x`);
  say(`database reads: ${core.reads} for 201 API calls`);

  step('Task 3 · bug 1, the stale read');
  await getBalance(client, 9003); // make sure it is cached
  const actual = await postDebit(client, 9003, 1_244.8, { invalidate: false });
  const served = (await getBalance(client, 9003)).balance;
  cmd('debit posted WITHOUT invalidation', '');
  say(`  core banking says ${actual}   the customer is shown ${served}   ← stale`);
  say(`  and it stays wrong for up to ${TTL} seconds`);

  await postDebit(client, 9003, 0, { invalidate: true });
  const fixed = await getBalance(client, 9003);
  say(`  with UNLINK in the write path: ${fixed.source} ${fixed.balance}   ← correct`);

  step('Task 4 · bug 2, the stampede');
  await reset(client, 'icici:bal:seed:*');
  const same = client.multi();
  for (let i = 0; i < 1_000; i += 1) same.set(`icici:bal:seed:${i}`, '1', { EX: TTL });
  await same.exec();
  const ttls = [];
  for (let i = 0; i < 5; i += 1) ttls.push(await client.ttl(`icici:bal:seed:${i}`));
  say(`  1,000 keys populated in one loop → TTLs ${ttls.join(', ')} …identical`);
  say(`  in ${TTL}s they all expire in the same second, every request misses at`);
  say('  once, and the whole day\'s traffic hits the database simultaneously.');

  const jittered = client.multi();
  for (let i = 0; i < 1_000; i += 1) {
    jittered.set(`icici:bal:seed:${i}`, '1', { EX: TTL + Math.floor(Math.random() * 60) });
  }
  await jittered.exec();
  const spread = [];
  for (let i = 0; i < 5; i += 1) spread.push(await client.ttl(`icici:bal:seed:${i}`));
  say(`  with jitter → TTLs ${spread.join(', ')} …spread over a minute`);

  step('Task 4b · for genuinely hot keys, guard the refill as well');
  const token = randomUUID();
  const won = await client.set('lock:refill:icici:bal:9003', token, { NX: true, PX: 5_000 });
  const lost = await client.set('lock:refill:icici:bal:9003', randomUUID(), { NX: true, PX: 5_000 });
  say(`  worker A acquired the refill lock: ${won === 'OK'}`);
  say(`  worker B acquired the refill lock: ${lost === 'OK'}  → waits, or serves the last value`);
  await client.unlink('lock:refill:icici:bal:9003');

  step('Task 5 · what happens when Redis is down');
  say('  Re-run this file with REDIS_URL pointed at a dead port. Every cache call');
  say('  is inside try/catch, so getBalance falls through to the stub and the API');
  say('  keeps answering - slower, but answering.');

  step('Task 6 · is the cache earning its place?');
  cmd('INFO stats → keyspace_hits / (hits + misses)', `${(await hitRate(client)).toFixed(1)}%`);
  say('Below roughly 80% the TTL or the key design needs rethinking.');

  await reset(client, 'icici:bal:seed:*');
  takeaway(
    'Always a TTL, jittered · invalidate at the write · delete rather than '
    + 'update · never fail the request because the cache failed.',
  );
}

main(recipe);
