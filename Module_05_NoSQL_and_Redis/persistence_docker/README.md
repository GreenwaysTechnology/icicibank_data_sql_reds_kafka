# Redis Persistence in Docker

Companion files for `06_Redis_Persistence.pptx` and
`Lab_Guide_Redis_Persistence_Docker.pdf`. Every command and every number in
those two documents was run against `redis:7-alpine` (measured as
**Redis 7.4.11**) on Docker Desktop **29.8.0** on this machine on 2026-09-23 -
nothing here is invented.

## Files

| File | What it is |
|------|------------|
| `redis-persistence.conf` | A `redis.conf` tuned for durability, written to run as PID 1 inside a container (`daemonize no`, logs to stdout, `dir /data`). Verified: boots clean, enforces the password, `appendfsync everysec`, `maxmemory 512mb`, `FLUSHALL`/`FLUSHDB`/`KEYS` disabled. |
| `docker-compose.yml` | One service, a named volume (`icici_redis_data`), the conf file mounted read-only, a healthcheck, `restart: unless-stopped`, and a 768 MB memory limit. Verified: `docker compose up -d` reaches `healthy`, data survives `down` / `up`, and is deleted by `down -v`. |
| `.env.example` | Copy to `.env` and set `REDIS_PASSWORD`. Compose refuses to start without it (`:?` in the compose file). |

## Quick start

```bash
cd persistence_docker
cp .env.example .env
# edit .env and set a real REDIS_PASSWORD
docker compose up -d
docker compose ps                 # STATUS should reach "healthy" within ~15s
```

```bash
source .env   # or set $REDIS_PASSWORD in PowerShell: $env:REDIS_PASSWORD
docker exec icici-redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning PING
```

Stop it, keeping the data:

```bash
docker compose down
```

Stop it and **destroy** the data (only for a deliberate reset):

```bash
docker compose down -v
```

## Without compose - the plain `docker run`

```bash
docker volume create icici_redis_data
docker run -d --name icici-redis \
  -p 6379:6379 \
  -v icici_redis_data:/data \
  -v "$(pwd)/redis-persistence.conf:/usr/local/etc/redis/redis.conf:ro" \
  redis:7-alpine redis-server /usr/local/etc/redis/redis.conf \
    --requirepass "TrainLab#2026Redis"
```

## The two rules this whole folder exists to teach

1. **`-v name:/data` (or a bind mount) is not optional.** A container with no
   volume keeps its RDB/AOF files in the container's own writable layer.
   `docker rm` throws that layer away. Measured on this machine: a key
   written with no volume mounted was gone - `DBSIZE` read `0` - the moment
   the container was recreated. Lab P.1 in the lab guide reproduces this on
   purpose before showing the fix.

2. **`docker compose down -v` and an anonymous volume are the two ways this
   goes wrong in the field.** `down` (no `-v`) stops and removes the
   *container*; the named volume it was attached to is untouched, and the
   next `up` reattaches to it. `-v` deletes the volume too - verified on
   this machine: `icici_redis_data` was gone from `docker volume ls`
   immediately after `docker compose down -v`. Never run `-v` against a
   volume you have not already backed up.

## What is measured, not asserted

Every number below came from a real container run on this machine, in this
order, on 2026-09-23. Full transcripts are in `Lab_Guide_Redis_Persistence_Docker.pdf`.

- RDB survives a container recreated from the same named volume: `DBSIZE`
  `3` before, `3` after, both balance keys read back byte for byte.
- Enabling AOF (`appendonly yes`) creates a **Multi Part AOF** directory,
  not a single file: `appendonly.aof.1.base.rdb` (an RDB snapshot),
  `appendonly.aof.1.incr.aof` (the tail), `appendonly.aof.manifest`
  (the index).
- `BGREWRITEAOF` after 50 more writes collapsed a 2,355-byte incr file into
  a 1,263-byte base file and bumped the sequence number from `1` to `2`.
- A deliberately corrupted incr file (`\n*3\r\n$3\r\nSET\r\ncorrupt-partial-write`
  appended with the server stopped) made `redis-server` refuse to start with
  `Bad file format reading the append only file ... use ./redis-check-aof --fix`.
  `redis-check-aof --fix` truncated the 35 corrupt bytes and the server then
  started clean.
- `docker cp` of `/data/dump.rdb` into a brand-new container on a brand-new
  volume restored all 53 keys - the disaster-recovery drill in Lab P.5.

## Cleaning up

```bash
docker compose down -v
docker volume rm icici_redis_data 2>/dev/null || true
rm -f .env
```
