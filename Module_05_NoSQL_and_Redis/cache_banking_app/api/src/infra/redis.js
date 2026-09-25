/**
 * infra/redis.js - the single shared Redis connection.
 *
 * A cache must never take the application down with it: if Redis is
 * unreachable the API keeps serving from PostgreSQL (see cache/cacheService.js).
 */
import { createClient } from 'redis';
import { config } from '../config/index.js';

export const redis = createClient({
  url: config.redis.url,
  socket: {
    connectTimeout: 3000,
    // keep retrying in the background, at most every 2 s
    reconnectStrategy: (retries) => Math.min(retries * 200, 2000),
  },
});

let lastError = '';
redis.on('error', (err) => {
  if (err.message !== lastError) console.error('[redis] error:', err.message);
  lastError = err.message;
});
redis.on('ready', () => {
  lastError = '';
  console.log('[redis] connected', config.redis.url);
});

export async function connectRedis() {
  try {
    await redis.connect();
  } catch (err) {
    console.error('[redis] initial connect failed - running without cache:', err.message);
  }
}
