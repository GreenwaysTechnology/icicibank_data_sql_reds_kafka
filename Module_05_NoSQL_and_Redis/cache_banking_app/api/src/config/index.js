/**
 * config/index.js - every tunable in one place, read from environment variables.
 * docker-compose.yml sets these; the defaults let `npm start` work on a laptop.
 */
const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));

export const config = {
  port: int(process.env.PORT, 4000),

  postgres: {
    host: process.env.PGHOST ?? 'localhost',
    port: int(process.env.PGPORT, 5433),
    database: process.env.PGDATABASE ?? 'horizonbank',
    user: process.env.PGUSER ?? 'bank',
    password: process.env.PGPASSWORD ?? 'bank_pass',
    max: int(process.env.PG_POOL_MAX, 10),
  },

  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6380',
  },

  cache: {
    // Master switch - set CACHE_ENABLED=false to watch every request hit PostgreSQL
    enabled: (process.env.CACHE_ENABLED ?? 'true') !== 'false',
    // How long a cached statement / account list may live before Redis deletes it
    ttlSeconds: int(process.env.CACHE_TTL_SECONDS, 300),
    // Random 0..N seconds added to each TTL so keys written together do not expire together
    ttlJitterSeconds: int(process.env.CACHE_TTL_JITTER_SECONDS, 30),
    // Every key this app owns starts with this prefix
    keyPrefix: process.env.CACHE_KEY_PREFIX ?? 'bank',
    // How many recent transactions one cached statement holds
    statementSize: int(process.env.STATEMENT_SIZE, 50),
    // After a transfer: 'refresh' rewrites the keys from the DB (write-through),
    // 'invalidate' just deletes them and lets the next read reload (cache-aside)
    onWrite: process.env.CACHE_ON_WRITE ?? 'refresh',
  },
};
