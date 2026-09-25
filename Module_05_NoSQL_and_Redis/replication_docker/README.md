# Redis Replication in Docker

Companion file for `07_Redis_Replication.pptx` and
`Lab_Guide_Redis_Replication_Docker.pdf`. Every command and every number in
those two documents was run against a real 3-container `redis:7-alpine`
topology (1 primary, 2 replicas) on this machine on 2026-09-23 - nothing
here is invented.

## Files

| File | What it is |
|------|------------|
| `docker-compose.yml` | Three services - `redis-primary`, `redis-replica1`, `redis-replica2` - each replica pointed at `redis-primary` **by container name**, with `depends_on: condition: service_healthy` so a replica never races the primary's startup. Verified: reaches `connected_slaves:2` within seconds, and the primary can be `--force-recreate`d mid-session with both replicas reattaching automatically. |

There is no `.env` here and no password - this pack is scoped to the
mechanics of replication itself, deliberately kept separate from
`persistence_docker/`'s durability/auth concerns so the two topics don't
tangle. A production topology would combine both: `redis-persistence.conf`
per node, plus the `--replicaof` wiring shown here.

## Quick start

```bash
cd replication_docker
docker compose up -d
docker compose ps                          # all three should be Up, primary "healthy"
docker exec icici-redis-primary redis-cli INFO replication | grep connected_slaves
#   connected_slaves:2
```

Stop it, keeping the data:

```bash
docker compose down
```

Stop it and **destroy** the data (only for a deliberate reset):

```bash
docker compose down -v
```

## Without compose - three plain `docker run` calls

```bash
docker network create icici-repl-net
docker run -d --name redis-primary --network icici-repl-net -p 7001:6379 \
  redis:7-alpine redis-server --save 60 1000

docker run -d --name redis-replica1 --network icici-repl-net -p 7002:6379 \
  redis:7-alpine redis-server --replicaof redis-primary 6379

docker run -d --name redis-replica2 --network icici-repl-net -p 7003:6379 \
  redis:7-alpine redis-server --replicaof redis-primary 6379
```

## The one rule this whole folder exists to teach

**Wire replicas to a primary by container name, never by IP.** A container's
IP is reassigned every time it is recreated; its name is not, and Docker's
embedded DNS (on any user-defined network, or automatically under compose)
resolves that name fresh on every lookup. Measured on this machine:
`docker compose up -d --force-recreate redis-primary` gave the primary a new
IP, and both replicas' `INFO replication` showed `master_link_status:up`
again within seconds - because they had been told `--replicaof
redis-primary 6379`, not an address.

## What is measured, not asserted

Every number below came from a real container topology on this machine, in
this order, on 2026-09-23. Full transcripts are in
`Lab_Guide_Redis_Replication_Docker.pdf`.

- A brand-new replica performs a **full sync**: the primary's log shows
  `Starting BGSAVE for SYNC with target: replicas sockets` (diskless - no
  `dump.rdb` written) followed by `Synchronization with replica ... succeeded`.
- A replica refuses a direct write: `(error) READONLY You can't write
  against a read only replica.`
- `WAIT 2 1000` after a write returned `(integer) 2` - both replicas had
  already acknowledged the offset.
- A replica disconnected for a few seconds and reconnected triggered a
  **partial** resync: `Partial resynchronization request ... accepted.
  Sending 0 bytes of backlog starting from offset 266.` - `sync_full` did
  not increment, `sync_partial_ok` did.
- A node that had briefly been a primary (during a failover drill) tried to
  rejoin and was refused a partial resync: `Partial resynchronization not
  accepted: Replication ID mismatch` - Redis fell back to a full resync
  rather than guess at missing data.
- Manual failover end to end: `docker stop redis-primary` →
  `redis-replica1` showed `master_link_status:down` → `REPLICAOF NO ONE` on
  replica1 → `REPLICAOF redis-replica1 6379` on replica2 → a write on
  replica1 appeared on replica2 about a second later.

## Cleaning up

```bash
docker compose down -v
docker network rm icici-repl-net 2>/dev/null || true
```
