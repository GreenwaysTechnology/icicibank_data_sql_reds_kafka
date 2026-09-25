/**
 * cache/cacheService.js - the ONLY file that talks to Redis.
 *
 * Pattern: cache-aside (lazy loading)
 *   read  -> GET key -> hit? return it : load from PostgreSQL, SET key EX ttl, return
 *   write -> change PostgreSQL first, then refresh (or delete) the affected keys
 *
 * Redis commands used:
 *   getOrLoad()  GET key + TTL key (one pipelined round trip), SET key value EX ttl on a miss
 *   refresh()    SET key value EX ttl
 *   invalidate() DEL key [key ...]
 *   countHit()   INCR bank:stats:hits / bank:stats:misses
 *   listKeys()   SCAN 0 MATCH bank:* COUNT 100, then TTL + MEMORY USAGE per key
 */
import { redis } from '../infra/redis.js';
import { config } from '../config/index.js';

const P = config.cache.keyPrefix;

/* ---------------------------------------------------------------- key names */
export const keys = {
  statement: (accountNo) => `${P}:txns:${accountNo}`,
  accounts: (customerId) => `${P}:accounts:${customerId}`,
  hits: `${P}:stats:hits`,
  misses: `${P}:stats:misses`,
};

const usable = () => config.cache.enabled && redis.isReady;

const ttlWithJitter = () =>
  config.cache.ttlSeconds + Math.floor(Math.random() * (config.cache.ttlJitterSeconds + 1));

/* ------------------------------------------------------------ primitives */
async function get(key) {
  const raw = await redis.get(key);
  return raw === null ? null : JSON.parse(raw);
}

async function set(key, value) {
  const ttl = ttlWithJitter();
  await redis.set(key, JSON.stringify(value), { EX: ttl });
  return ttl;
}

async function countHit(hit) {
  await redis.incr(hit ? keys.hits : keys.misses);
}

/**
 * Cache-aside read. Returns { data, source, ttl, key }.
 * source is 'cache' | 'database' | 'database (cache off)' | 'database (redis down)'.
 */
export async function getOrLoad(key, loader) {
  if (!config.cache.enabled) {
    return { data: await loader(), source: 'database (cache off)', ttl: null, key };
  }
  if (!redis.isReady) {
    return { data: await loader(), source: 'database (redis down)', ttl: null, key };
  }

  let cached;
  let ttl;
  try {
    // GET and TTL issued in the same tick -> node-redis pipelines them into one round trip
    [cached, ttl] = await Promise.all([get(key), redis.ttl(key)]);
  } catch (err) {
    // Redis failed mid-request: the database still answers
    console.error('[cache] read failed, falling back to database:', err.message);
    return { data: await loader(), source: 'database (redis down)', ttl: null, key };
  }

  if (cached !== null) {
    countHit(true).catch(() => {}); // metrics must never slow down or fail a read
    console.log(`[cache] HIT   ${key} (ttl ${ttl}s)`);
    return { data: cached, source: 'cache', ttl, key };
  }

  countHit(false).catch(() => {});
  const data = await loader(); // a 404 from the loader propagates as-is
  try {
    ttl = await set(key, data);
    console.log(`[cache] MISS  ${key} -> loaded from PostgreSQL, SET EX ${ttl}`);
  } catch (err) {
    ttl = null;
    console.error('[cache] write failed (response still served):', err.message);
  }
  return { data, source: 'database', ttl, key };
}

/** Write-through refresh: put fresh data in the cache right after a DB write. */
export async function refresh(key, loader) {
  if (!usable()) return null;
  const data = await loader();
  const ttl = await set(key, data);
  console.log(`[cache] UPDATE ${key} -> refreshed after write, SET EX ${ttl}`);
  return { key, action: 'refreshed', ttl };
}

/** Invalidation: delete the keys; the next read reloads them. */
export async function invalidate(...keyList) {
  if (!usable() || keyList.length === 0) return [];
  await redis.del(keyList);
  console.log(`[cache] DEL   ${keyList.join(' ')}`);
  return keyList.map((key) => ({ key, action: 'deleted', ttl: null }));
}

/* ------------------------------------------------------------ inspection */
export async function stats() {
  if (!redis.isReady) {
    return { redis: 'down', enabled: config.cache.enabled, hits: 0, misses: 0, hitRate: 0 };
  }
  const [h, m, info] = await Promise.all([
    redis.get(keys.hits), redis.get(keys.misses), redis.info('memory'),
  ]);
  const hits = Number(h ?? 0);
  const misses = Number(m ?? 0);
  const field = (name) => (info.match(new RegExp(`^${name}:(.*)$`, 'm')) ?? [])[1]?.trim();
  return {
    redis: 'up',
    enabled: config.cache.enabled,
    ttlSeconds: config.cache.ttlSeconds,
    onWrite: config.cache.onWrite,
    hits,
    misses,
    hitRate: hits + misses === 0 ? 0 : Math.round((hits / (hits + misses)) * 1000) / 10,
    usedMemory: field('used_memory_human'),
    maxMemory: field('maxmemory_human'),
    policy: field('maxmemory_policy'),
  };
}

export async function listKeys() {
  if (!redis.isReady) return [];
  const found = [];
  for await (const batch of redis.scanIterator({ MATCH: `${P}:*`, COUNT: 100 })) {
    found.push(...(Array.isArray(batch) ? batch : [batch]));
  }
  const rows = await Promise.all(found.sort().map(async (key) => ({
    key,
    ttl: await redis.ttl(key),
    bytes: await redis.memoryUsage(key),
  })));
  return rows;
}

/** Remove every key this app owns (the demo "clear cache" button). */
export async function clearAll() {
  const all = (await listKeys()).map((k) => k.key);
  if (all.length) await redis.del(all);
  console.log(`[cache] CLEAR ${all.length} keys`);
  return all.length;
}
