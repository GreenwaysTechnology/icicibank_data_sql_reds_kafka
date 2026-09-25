/**
 * 02 · STRING · Balance cache (cache-aside)
 * ---------------------------------------------------------------------
 * Use case    Balance enquiry is ~70% of retail API traffic and the balance
 *             changes rarely. Put Redis in front of the core banking DB.
 * Structure   String holding the cached value, with a TTL.
 * Commands    GET · SET ... EX · UNLINK · INFO stats
 * Why Redis   A 4 ms database round trip becomes a 0.1 ms memory read, and
 *             the database stops being the bottleneck at peak.
 * Watch out   The four rules at the bottom of this file are the whole job.
 *             Getting caching wrong is worse than not caching at all.
 * Run         node src/02_string_cache_aside.js
 */
import { main, banner, step, cmd, say, takeaway, sleep } from './_client.js';

const TTL = 300; // five minutes
const key = (acct) => `icici:bal:${acct}`;

/* ------------------------------------------------------------------ */
/* A stand-in for PostgreSQL so this recipe runs with nothing else     */
/* installed. Every read costs 50 ms, like a real query over a network.*/
/* ------------------------------------------------------------------ */
const core = {
  rows: { 9001: 118450.0, 9002: 7320.55, 9003: 341244.8 },
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

/* ------------------------------------------------------------------ */
/* The pattern                                                         */
/* ------------------------------------------------------------------ */

async function getBalance(client, acct) {
  const k = key(acct);

  // RULE 4 - a cache failure must never fail the request.
  try {
    const cached = await client.get(k);
    if (cached !== null) return { balance: Number(cached), source: 'HIT' };
  } catch (err) {
    console.error('    cache read failed, falling through to the DB:', err.message);
  }

  const balance = await core.selectBalance(acct);
  if (balance === null) return { balance: null, source: 'MISS' };

  try {
    // RULE 1 - always a TTL, and jitter it so a whole page of keys does not
    // expire on the same second and stampede the database.
    const jitter = Math.floor(Math.random() * 60);
    await client.set(k, String(balance), { EX: TTL + jitter });
  } catch (err) {
    console.error('    cache write failed, ignoring:', err.message);
  }

  return { balance, source: 'MISS' };
}

async function postDebit(client, acct, amount) {
  const balance = await core.applyDebit(acct, amount);

  // RULE 2 - invalidate in the same code path as the write.
  // RULE 3 - delete, do not overwrite. An overwrite can race with a read
  //          that is already on its way back with the old value.
  await client.unlink(key(acct));
  return balance;
}

/* ------------------------------------------------------------------ */

async function hitRate(client) {
  const info = await client.info('stats');
  const num = (name) => Number(info.match(new RegExp(`${name}:(\\d+)`))?.[1] ?? 0);
  const hits = num('keyspace_hits');
  const misses = num('keyspace_misses');
  return { hits, misses, pct: (100 * hits) / Math.max(1, hits + misses) };
}

async function recipe(client) {
  banner('02', 'String', 'Balance cache, the cache-aside pattern');
  await client.unlink(key(9003));

  step('First read - a miss, so it costs a database round trip');
  let t = performance.now();
  const cold = await getBalance(client, 9003);
  const coldMs = performance.now() - t;
  cmd(`GET ${key(9003)}`, '(nil) → query the core banking DB → populate');
  say(`${cold.source}  balance ${cold.balance}  in ${coldMs.toFixed(2)} ms`);

  step('Next 200 reads - all hits');
  t = performance.now();
  for (let i = 0; i < 200; i += 1) await getBalance(client, 9003);
  const warmMs = (performance.now() - t) / 200;
  say(`HIT   average ${warmMs.toFixed(3)} ms  ·  speed-up ${Math.round(coldMs / warmMs)}x`);
  say(`database reads so far: ${core.reads} (for 201 API calls)`);

  step('A debit posts - and this is where caches go wrong');
  const before = await client.get(key(9003));
  await postDebit(client, 9003, 1244.8);
  const after = await client.get(key(9003));
  cmd(`UNLINK ${key(9003)}`, '(integer) 1');
  say(`cached before the debit: ${before}`);
  say(`cached after the debit : ${after === null ? '(nil) - the next read repopulates' : after}`);
  const fresh = await getBalance(client, 9003);
  say(`next read: ${fresh.source}  balance ${fresh.balance}  — correct, not stale`);

  step('Without that UNLINK line');
  say('The balance in PostgreSQL is right and the balance in Redis is wrong,');
  say(`for up to ${TTL} seconds. The customer sees money they have already spent.`);
  say('This is the single most common caching bug in production.');

  step('Is the cache earning its place?');
  const { hits, misses, pct } = await hitRate(client);
  cmd('INFO stats', `keyspace_hits:${hits}  keyspace_misses:${misses}`);
  say(`hit rate ${pct.toFixed(1)}%  —  below ~80% means the TTL or the key design is wrong`);

  takeaway(
    'Always set a TTL · invalidate at the write · delete rather than update · '
    + 'never let a cache error fail the request.',
  );
}

main(recipe);
