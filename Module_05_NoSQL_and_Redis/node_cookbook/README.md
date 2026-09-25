# Redis with Node.js — 15 small programs

One short program per Redis data type. Each file is **complete on its own**:
open it, read it top to bottom, run it, and you have learned one thing.

There is no shared framework and no helper files to understand first. Every
program is about 50 lines, and most of those lines are comments.

## Before you start

You need two things: **Node.js 18 or newer**, and a **running Redis server**.

```bash
node --version
```

Start Redis with Docker:

```bash
docker run -d --name redis-m07 -p 6379:6379 redis:7-alpine
```

Then install the Redis library for Node:

```bash
cd node_cookbook
npm install
```

## How to run a program

```bash
node src/01_string_counter.js
```

Or use the short name:

```bash
npm run 01
```

Run all fifteen, one after another:

```bash
npm run all
```

Run just a few:

```bash
node run-all.js 03 07 12
```

Every program deletes its own keys before it starts, so you can run the same
file as many times as you like and always get the same output.

## The 15 programs

| # | Redis type | What it does | Main commands |
|---|-----------|--------------|---------------|
| 01 | String | Counting page views | `INCR` `INCRBY` `GET` `MGET` |
| 02 | String + TTL | An OTP that deletes itself | `SET EX` `TTL` `EXPIRE` |
| 03 | Hash | A student profile | `HSET` `HGET` `HGETALL` `HINCRBY` |
| 04 | List | The last 5 songs played | `LPUSH` `LTRIM` `LRANGE` |
| 05 | List (queue) | Pizza orders, first in first out | `RPUSH` `LPOP` `LLEN` |
| 06 | Set | Who attempted the quiz | `SADD` `SISMEMBER` `SINTER` |
| 07 | Sorted Set | A game leaderboard | `ZADD` `ZINCRBY` `ZRANGE` `ZREVRANK` |
| 08 | String + TTL | Only 3 messages per minute | `INCR` `EXPIRE` |
| 09 | HyperLogLog | Counting unique visitors | `PFADD` `PFCOUNT` `PFMERGE` |
| 10 | Bitmap | Class attendance | `SETBIT` `GETBIT` `BITCOUNT` |
| 11 | Geo | Find the nearest cafe | `GEOADD` `GEOSEARCH` `GEODIST` |
| 12 | Stream | An activity log | `XADD` `XRANGE` `XREAD` |
| 13 | Pub/Sub | Class announcements | `SUBSCRIBE` `PUBLISH` |
| 14 | String + NX | Only one program at a time (a lock) | `SET NX EX` `DEL` |
| 15 | Transaction | Moving points between players | `MULTI` `EXEC` `WATCH` |

Read them in order. 01 to 07 are the core data types — if you only have time
for half the module, do those.

## Exercises

`exercises/` has six small tasks. Each file explains the task at the top, shows
you the expected output, and leaves `TODO` comments where your code goes.
The files run as they are — you will just see blank or wrong output until you
fill in the TODOs.

```bash
node exercises/ex1_likes.js
```

| # | Task | Practises |
|---|------|-----------|
| ex1 | Count likes on posts | program 01 |
| ex2 | A coupon code that expires | program 02 |
| ex3 | A library book | program 03 |
| ex4 | The last 3 searches | program 04 |
| ex5 | A class test — who submitted, and the top marks | programs 06 and 07 |
| ex6 | Only 2 downloads per user | program 08 |

The answers are in `exercises/solutions/`. Try the exercise first.

```bash
node exercises/solutions/ex1_likes.js
```

## The five lines at the top of every program

Every file starts the same way. This is the only boilerplate in the pack:

```js
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();
```

- `createClient()` with no address connects to `localhost:6379`.
- `reconnectStrategy: false` means *if Redis is not running, stop straight
  away*. Without it, Node would sit there retrying forever and your program
  would never finish.
- The `error` line prints a readable message instead of a wall of red text.
- `await` works at the top of the file because these are ES modules
  (`"type": "module"` in `package.json`). That is why there is no
  `async function main()` anywhere.

And every file ends with:

```js
await client.quit();
```

## Two things that surprise everybody

**1. Redis always gives you back a string.**

```js
await client.set('count', 5);
const n = await client.get('count');
console.log(n + 1);           // "51"  — string joining, not addition!
console.log(Number(n) + 1);   // 6     — correct
```

**2. A key that does not exist is `null`, not an error.**

```js
const missing = await client.get('no-such-key');
console.log(missing);   // null
```

Your code has to expect `null`. Show it as `0` or `"not found"` — do not let
it crash.

## Command names in Node

In `redis-cli` you type `HSET`, `ZADD`, `PFCOUNT`. In Node the same commands
are written in camelCase:

| redis-cli | Node |
|-----------|------|
| `HSET` | `client.hSet(...)` |
| `HGETALL` | `client.hGetAll(...)` |
| `ZADD` | `client.zAdd(...)` |
| `ZREVRANK` | `client.zRevRank(...)` |
| `PFCOUNT` | `client.pfCount(...)` |
| `SETBIT` | `client.setBit(...)` |

If you ever cannot find a method, you can always send the raw command:

```js
await client.sendCommand(['ANY', 'COMMAND', 'HERE']);
```

## If something goes wrong

**`Redis problem: connect ECONNREFUSED 127.0.0.1:6379`**
Redis is not running. Start it with the Docker command above.

**`Cannot find package 'redis'`**
You did not run `npm install`, or you are in the wrong folder.

**`SyntaxError: await is only valid in async functions`**
You are running an old Node. Check with `node --version` — you need 18 or newer.

## Folders

```
node_cookbook/
  src/           the 15 lesson programs
  exercises/     6 tasks with TODOs
    solutions/   the answers
  run-all.js     runs every lesson in order
  _old_version/  the previous, more advanced version of this pack
```

`_old_version/` is the earlier cookbook, kept in case you want the advanced
material: consumer groups, Lua scripts, reliable queues with `BLMOVE`, and
optimistic locking across two connections. It is not needed for this module
and can be deleted.

## Versions this was tested on

Node.js 26, `redis` npm package 6.2.1, Redis server 7.4. Every program in
`src/` and every file in `exercises/solutions/` was run against a real Redis
server, and the output shown in the comments is the output they actually
produced.
