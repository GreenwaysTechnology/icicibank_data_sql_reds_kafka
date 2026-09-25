# Redis Cluster in Docker

Companion files for `08_Redis_Cluster.pptx` and
`Lab_Guide_Redis_Cluster_Docker.pdf`. Every command and every number in those
two documents was run against real `redis:7-alpine` containers (Redis 7.4.11)
on this machine on 2026-09-24 - nothing here is invented.

## Files

| File | What it is |
|------|------------|
| `docker-compose.yml` | Six cluster-enabled nodes (3 masters + 3 replicas) with **fixed IPs** 172.30.0.11-16, a named volume per node for `/data`, host ports 7101-7106, and a one-shot `cluster-init` service that runs `--cluster create` only when the cluster is not already formed. Verified: reaches `cluster_state:ok` from one `up -d`; survives `down` + `up` with the same node IDs and all 3001 keys; fails over when a master is stopped. |
| `client/package.json` | `npm install` pulls node-redis 6 (verified with 6.2.1). |
| `client/naive.js` | The host-side client that **hangs** - one seed, no address map. Run it once to see why. |
| `client/cluster_client.js` | The one that works: `nodeAddressMap` rewrites each advertised `172.30.0.x:6379` to `localhost:710x`, and `rootNodes` lists all six nodes. |

## Quick start

```bash
cd cluster_docker
docker compose up -d
docker logs icici-rc-init | tail -1              # [OK] All 16384 slots covered.
docker exec icici-rc-node1 redis-cli CLUSTER INFO | grep cluster_state
#   cluster_state:ok
docker exec -it icici-rc-node1 redis-cli -c      # -c: follow MOVED redirects

cd client && npm install && npm start
```

Stop it, keeping the data: `docker compose down`.
Destroy the data too: `docker compose down -v`.

Ports 7101-7106 and the network name `icici-cluster-net` are the same ones the
hand-built cluster in labs C.1-C.6 uses - remove that cluster first.

## The three rules this folder exists to teach

1. **Pin the IPs.** The cluster bus remembers every peer by IP in
   `nodes.conf`. Fixed `ipv4_address`es keep that file true across restarts,
   and let the client's address map be written once.
2. **Keep `/data` on a volume.** It holds `nodes.conf` (node ID, slots,
   peers) as well as the AOF. A node that loses it has forgotten it was ever
   in a cluster.
3. **Seed clients with several nodes.** With node1 stopped, a client whose
   only `rootNodes` entry was `localhost:7101` threw
   `RootNodesUnavailableError` from `connect()` while the cluster was serving
   every slot. Seeded with all six, the same client connected and worked.

## What is measured, not asserted

Hand-built 6-node cluster (labs C.1-C.6), unless stated otherwise:

- A fresh cluster-enabled node: `cluster_state:fail`, 0 slots, and
  `SET` answers `CLUSTERDOWN Hash slot not served`. Its log says
  `Changing databases number from 16 to 1 since we are in cluster mode`.
- `--cluster create` accepted container names and split the slots
  5461 / 5462 / 5461. It paired node5→node1, node6→node2, node4→node3 -
  not the order typed.
- Slots: `icici:acct:1001` 12170, `icici:acct:1002` 8169,
  `icici:bal:9003` 6348, `{icici:cust:42}:*` 2022.
- `MSET` across slots → `CROSSSLOT`; the same keys with a hash tag → `OK`.
  3000 keys spread 1011 / 1002 / 992 across the masters. `SELECT 1` →
  `ERR SELECT is not allowed in cluster mode`.
- Replica reads: `MOVED` until `READONLY`; writes still `MOVED`.
- **Automatic failover**, `cluster-node-timeout 5000`: node5 lost node1 at
  01:51:55.657, masters marked it FAIL at 02.532 (+6.9 s), the election
  (delayed 808 ms) was won at 03.660 (+8.0 s), cluster `ok` at 03.674. The
  restarted node1 rejoined as node5's replica on its own, with a full resync.
- `CLUSTER FAILOVER` on the replica swapped roles with no loss; on a master
  it answers `ERR You should send CLUSTER FAILOVER to a replica`. In one run
  the election finished 2.5 s after the `OK`.
- Master and replica both stopped: `cluster_state:fail`, and even the healthy
  slot 2022 answered `CLUSTERDOWN The cluster is down` - until
  `cluster-require-full-coverage no`. Restarting both lost nothing.
- Scale-out: a reshard started seconds after `add-node` failed with
  `CLUSTERDOWN` from the not-yet-converged new node, leaving slot 5466 open;
  `--cluster fix` repaired it and the rerun moved 994 slots in 10 s.
  `rebalance` gave 4 × 4096 slots; weight 0 then put the key counts back to
  exactly 1011 / 1002 / 992, and `del-node` removed both extra nodes.
- From the Windows host, node-redis 6.2.1 with no address map hangs;
  with `nodeAddressMap` a single-slot `MULTI` works and a cross-slot one
  throws `MaxCommandRedirectionsError`.

## Cleaning up

```bash
docker compose down -v
docker volume ls -q | grep icici_rc || echo "no icici_rc volumes left"
```
