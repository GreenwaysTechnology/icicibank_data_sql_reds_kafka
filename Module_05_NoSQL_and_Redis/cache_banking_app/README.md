# Horizon Bank - Redis cache demo app

Companion app for `09_Redis_Caching.pptx`, `Redis_Caching_Guide.pdf` and
`Horizon_Bank_App_Guide.pdf`. A net-banking dashboard with one screen and two
menu items (**Transactions**, **Fund Transfer**) that shows Redis caching in
a real application:

| Container | Image | Role | Host port |
|-----------|-------|------|-----------|
| `bank-web` | nginx:1.27-alpine (React 18 bundle built by Vite) | UI; proxies `/api` | 8080 |
| `bank-api` | node:22-alpine (Express 4, node-redis 6, pg 8) | REST API, cache-aside logic | 4000 |
| `bank-postgres` | postgres:16-alpine | Source of truth: 3 tables, seeded | 5433 |
| `bank-redis` | redis:7-alpine (`redis/redis-cache.conf`) | Cache: 64 MB, allkeys-lru, no persistence | 6380 |

Horizon Bank is fictional; all data is synthetic.

## Quick start

```bash
cd cache_banking_app
docker compose up -d --build
# open http://localhost:8080
bash scripts/cache-demo.sh        # command-line walk-through (Git Bash / WSL)
```

Stop with `docker compose down`; wipe and re-seed with `docker compose down -v`
then `up -d --build`.

## What to look for

- **Transactions**: the first enquiry of an account is an amber *Cache MISS -
  loaded from PostgreSQL*; **Enquire again** turns it into a green *Redis cache
  HIT* with the key's remaining TTL. Key: `bank:txns:<accountNo>`.
- **Fund Transfer**: moves money in one PostgreSQL transaction
  (`SELECT ... FOR UPDATE`, two balance updates, a DEBIT and a CREDIT row),
  and only **after COMMIT** refreshes every affected key
  (`bank:txns:<from>`, `bank:txns:<to>`, `bank:accounts:<owner>`). The next
  statement read is a HIT that already contains the transfer.
- **Cache Inspector** (bottom strip): live `bank:*` keys with TTL and size, hit
  rate, memory, eviction policy, and a *Clear cache* button.

## Cache configuration

Set in `docker-compose.yml`, overridable from the shell, e.g.
`CACHE_ON_WRITE=invalidate docker compose up -d api`.

| Variable | Default | Meaning |
|----------|---------|---------|
| `CACHE_ENABLED` | `true` | `false` sends every read to PostgreSQL |
| `CACHE_TTL_SECONDS` | `300` | Base TTL of every cached value |
| `CACHE_TTL_JITTER_SECONDS` | `30` | Random 0..N s added so keys do not expire together |
| `CACHE_ON_WRITE` | `refresh` | After a transfer: `refresh` (SET) or `invalidate` (DEL) |
| `STATEMENT_SIZE` | `50` | Transactions per cached statement |

Redis-side settings (`maxmemory`, `maxmemory-policy`, lazyfree, persistence
off) are in `redis/redis-cache.conf`.

## Layout

```
db/init/            01_schema.sql (customers, accounts, transactions) · 02_seed.sql
redis/              redis-cache.conf
api/src/            config/ · infra/ (pg pool, redis client) · cache/cacheService.js
                    repositories/ · services/ · routes/ · middleware/ · server.js
web/src/            App.jsx · api.js · styles.css · components/ (7)
scripts/            cache-demo.sh
```

Only `api/src/cache/cacheService.js` imports the Redis client; only
`api/src/repositories/` contains SQL.

## Measured on this machine (2026-09-25)

Docker Desktop 29.8.0, Redis 7.4.11, 507 seeded transactions, 100 requests
each against one statement, timed inside the API:

| | p50 | p95 |
|---|---|---|
| Cache MISS (PostgreSQL + SET) | 3.3 ms | 5.4 ms |
| Cache HIT | 0.9 ms | 1.6 ms |

Also verified: `CACHE_ON_WRITE=invalidate` returns `deleted` keys and the next
read is a MISS; `CACHE_ENABLED=false` serves `database (cache off)`; with
`bank-redis` stopped the API serves `database (redis down)` and reconnects by
itself when Redis returns; 20 cache hits leave PostgreSQL's `xact_commit`
unchanged while 20 misses add 40.
