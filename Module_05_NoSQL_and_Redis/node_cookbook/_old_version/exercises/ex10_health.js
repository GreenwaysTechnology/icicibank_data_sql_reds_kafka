/**
 * Exercise 10 — health.js
 * The script an on-call engineer runs at 02:00.
 *
 *   node exercises/ex10_health.js
 *   REDIS_URL=redis://127.0.0.1:6380 node exercises/ex10_health.js
 *
 * Exit codes, so it can be wired into monitoring:
 *   0  healthy      1  warning      2  critical (or unreachable)
 */
import { createClient } from 'redis';

const URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

const THRESHOLDS = {
  hitRate: 80, // %  below this, the cache is not earning its place
  memoryPct: 85, // %  of maxmemory
  fragmentation: 1.5, // RSS / used_memory
};

function parseInfo(raw) {
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((line) => line.includes(':') && !line.startsWith('#'))
      .map((line) => line.trim().split(':')),
  );
}

const human = (bytes) => {
  const units = ['B', 'K', 'M', 'G', 'T'];
  let n = Number(bytes);
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(1)}${units[i]}`;
};

const uptime = (seconds) => {
  const d = Math.floor(seconds / 86_400);
  const h = String(Math.floor((seconds % 86_400) / 3_600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3_600) / 60)).padStart(2, '0');
  return `${d}d ${h}:${m}`;
};

async function main() {
  const client = createClient({
    url: URL,
    socket: {
      connectTimeout: 3_000,
      // A health check must fail fast, not retry forever.
      reconnectStrategy: (retries) => (retries > 1 ? new Error('unreachable') : 200),
    },
  });
  client.on('error', () => {}); // reported below, with an exit code

  try {
    await client.connect();
    await client.ping();
  } catch (err) {
    console.error(`CRIT  cannot reach Redis at ${URL}: ${err.message}`);
    process.exit(2);
  }

  const info = parseInfo(await client.info());

  // node-redis has no slowlogGet(); sendCommand takes any command verbatim.
  // Reply rows are [id, unixTime, microseconds, [args...], clientAddr, name].
  const slow = await client
    .sendCommand(['SLOWLOG', 'GET', '3'])
    .catch(() => []);

  await client.close();

  const hits = Number(info.keyspace_hits ?? 0);
  const misses = Number(info.keyspace_misses ?? 0);
  const hitRate = (100 * hits) / Math.max(1, hits + misses);
  const maxmemory = Number(info.maxmemory ?? 0);
  const used = Number(info.used_memory ?? 0);
  const memoryPct = maxmemory ? (100 * used) / maxmemory : 0;
  const frag = Number(info.mem_fragmentation_ratio ?? 0);

  console.log(`\n  redis ${info.redis_version}  ${info.redis_mode}  `
    + `up ${uptime(Number(info.uptime_in_seconds))}  clients ${info.connected_clients}`);
  console.log(`  role ${info.role}  replicas ${info.connected_slaves ?? 0}  `
    + `ops/sec ${info.instantaneous_ops_per_sec}`);
  console.log(`  memory     ${human(used)}`
    + `${maxmemory ? ` / ${human(maxmemory)}  (${memoryPct.toFixed(0)}%)` : '  (no maxmemory set)'}`
    + `   frag ${frag}`);
  console.log(`  hit rate   ${hitRate.toFixed(1)}%   `
    + `evicted ${Number(info.evicted_keys).toLocaleString('en-IN')}   `
    + `expired ${Number(info.expired_keys).toLocaleString('en-IN')}`);
  console.log(`  last save  rdb ${info.rdb_last_bgsave_status}  `
    + `aof ${info.aof_last_write_status ?? 'n/a'}  `
    + `(${info.rdb_changes_since_last_save} changes since)`);

  if (slow.length) {
    console.log('\n  slowest recent commands');
    for (const [, , micros, args] of slow) {
      const command = (args ?? []).map(String).join(' ').slice(0, 56);
      console.log(`    ${String(micros).padStart(8)} µs  ${command}`);
    }
  }

  const checks = [
    ['rdb last bgsave', info.rdb_last_bgsave_status === 'ok', 'CRIT',
      `rdb_last_bgsave_status=${info.rdb_last_bgsave_status}`],
    ['aof last write', (info.aof_last_write_status ?? 'ok') === 'ok', 'CRIT',
      `aof_last_write_status=${info.aof_last_write_status}`],
    ['memory headroom', !maxmemory || memoryPct < THRESHOLDS.memoryPct, 'WARN',
      `${memoryPct.toFixed(0)}% of maxmemory used`],
    ['hit rate', hits + misses < 1_000 || hitRate > THRESHOLDS.hitRate, 'WARN',
      `${hitRate.toFixed(1)}% - review the TTL or the key design`],
    ['fragmentation', !frag || frag < THRESHOLDS.fragmentation, 'WARN',
      `ratio ${frag} - the allocator is holding pages it cannot return`],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  console.log('');
  for (const [name, , severity, detail] of failed) {
    console.log(`  ${severity}  ${name}: ${detail}`);
  }

  const critical = failed.some(([, , severity]) => severity === 'CRIT');
  const code = critical ? 2 : failed.length ? 1 : 0;
  console.log(`  ${code === 0 ? 'OK    all checks passed' : `exit ${code}`}\n`);
  process.exit(code);
}

main();
