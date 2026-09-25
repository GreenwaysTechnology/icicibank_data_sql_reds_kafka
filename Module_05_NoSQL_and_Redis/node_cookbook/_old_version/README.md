# Redis × Node.js Cookbook — Module 07

One runnable program per Redis data structure, each wrapped around a real
ICICI use case. Read the header comment of a file, run it, then read the code.
The printed output narrates what is happening, so the terminal and the source
tell the same story.

The companion PDF is `../Node_Redis_Cookbook.pdf`.

## Setup

```bash
cd node_cookbook
npm install
```

You need a Redis 7.x instance. Any of these works:

```bash
docker run -d --name redis-m07 -p 6379:6379 redis:7-alpine
```

```bash
wsl -d Ubuntu -e sudo service redis-server start      # after apt install redis
```

Point the recipes somewhere else with an environment variable:

```bash
REDIS_URL=redis://10.2.4.9:6379 npm run all
```

## Running

```bash
npm run all              # all fifteen, in order
npm run r07              # just the branch leaderboard
node run-all.js 04 05    # a subset
node src/12_stream_txn_events.js
```

Every recipe cleans up the keys it owns before it starts, so reruns are safe
and nothing leaks between recipes. Nothing calls `FLUSHALL`.

## The map

| # | Structure | Use case | Key commands |
|---|-----------|----------|--------------|
| 01 | String (integer) | Website hit counter | `INCR` `INCRBY` `MGET` `EXPIRE` |
| 02 | String + TTL | Balance cache, cache-aside | `GET` `SET EX` `UNLINK` `INFO` |
| 03 | Hash | Customer profile cache | `HSET` `HGET` `HINCRBY` `HGETALL` |
| 04 | List (capped) | Last ten transactions | `LPUSH` `LTRIM` `LRANGE` `LINDEX` |
| 05 | List (two lists) | Reliable statement queue | `BLMOVE` `LREM` `LMOVE` |
| 06 | Set | Duplicate payment guard, segments | `SADD` `SINTER` `SDIFF` `SISMEMBER` |
| 07 | Sorted Set | Live branch leaderboard | `ZINCRBY` `ZRANGE REV` `ZREVRANK` |
| 08 | String + Sorted Set | API rate limiting, two ways | `INCR` `EXPIRE NX` `ZREMRANGEBYSCORE` |
| 09 | HyperLogLog | Daily / weekly unique visitors | `PFADD` `PFCOUNT` `PFMERGE` |
| 10 | Bitmap | Login streaks, daily active users | `SETBIT` `BITCOUNT` `BITOP` |
| 11 | Geospatial | Nearest ATM locator | `GEOADD` `GEOSEARCH` `GEODIST` |
| 12 | Stream | Transaction events, consumer groups | `XADD` `XREADGROUP` `XACK` `XAUTOCLAIM` |
| 13 | Pub/Sub | Fraud alert fan-out | `SUBSCRIBE` `PSUBSCRIBE` `PUBLISH` |
| 14 | String + Lua | Distributed lock for the EOD batch | `SET NX PX` `EVAL` |
| 15 | Transactions | Fund transfer, three ways | `MULTI` `WATCH` `EVAL` |

## Client library

[`node-redis`](https://github.com/redis/node-redis) v6 (`npm i redis`). The
code also runs unchanged on v4.6+ and v5 with one exception, which is called
out in a comment in recipe 15: `client.executeIsolated()` existed in v4 and v5
and was removed in v6, so the `WATCH` recipe takes a `duplicate()` connection
instead — which is correct on every version.

Command names are camelCase (`hSet`, `zRangeWithScores`, `pfCount`) and map
one-to-one onto the Redis commands you type in `redis-cli`. When you cannot
find a method, `client.sendCommand(['ANY', 'COMMAND', 'HERE'])` always works.

## Conventions used throughout

| Convention | Why |
|-----------|-----|
| `icici:<thing>:<id>` key names | The colon is the de facto namespace separator; RedisInsight and `--scan --pattern` both rely on it |
| Every cache key gets a TTL | A key nothing invalidates is wrong forever |
| `UNLINK`, not `DEL` | Frees memory on a background thread |
| `SCAN`, never `KEYS` | `KEYS` is O(n) on a single-threaded server |
| `MULTI` for batched writes | One round trip, nothing interleaved |
| Cache errors are swallowed | Redis going down must not take the API down with it |

## Exercise solutions

`exercises/` holds the worked answers to the five programs and the operations
task in `../Exercises.pdf`. **Write your own first** — several exercises are
deliberately close to a recipe here, and reading the answer first is the one
way to get nothing out of them.

```bash
npm run e05      # otp.js        — OTP issue, verify, lock-out
npm run e06      # cache.js      — cache-aside + both failure modes
npm run e07      # lock.js       — one server runs the EOD batch
npm run e08      # queue.js      — a queue that survives a crash
npm run e09      # dashboard.js  — four structures, one report
npm run e10      # health.js     — exits 0 / 1 / 2 for monitoring
```

`ex10_health.js` is the only file that takes no shared helper — it is meant to
be copied onto a server on its own.

## Files

```
node_cookbook/
├── package.json
├── run-all.js          runs every recipe in its own process
├── README.md
├── src/
│   ├── _client.js      connection + console formatting, shared by all
│   └── 01..15_*.js     one recipe each, standalone
└── exercises/
    └── ex05..ex10_*.js worked solutions to the exercise document
```
