/**
 * SOLUTION 6 - Only 2 downloads per user
 * Run: node exercises/solutions/ex6_download_limit.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

const LIMIT = 2;
const WINDOW = 5;

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function canDownload(user) {
  const key = 'downloads:' + user;

  // TODO 1: INCR gives back the new count, and that number is the answer.
  // Never do GET, add 1 in JavaScript, then SET - two users doing that at
  // the same moment would both read the same old number.
  const count = await client.incr(key);

  // TODO 2: only the FIRST download starts the clock. If you set the expiry
  // every time, the 5 seconds would keep restarting and never run out.
  if (count === 1) {
    await client.expire(key, WINDOW);
  }

  // TODO 3
  return count <= LIMIT;
}

await client.del('downloads:asha');

for (let i = 1; i <= 3; i++) {
  const ok = await canDownload('asha');
  console.log('Download', i, '->', ok ? 'allowed' : 'BLOCKED');
}
// 1 allowed, 2 allowed, 3 BLOCKED

console.log('Waiting 6 seconds...');
await wait(WINDOW + 1);

// The key expired, so INCR starts again from 1.
const ok = await canDownload('asha');
console.log('Download 4 ->', ok ? 'allowed' : 'BLOCKED');   // allowed

await client.del('downloads:asha');
await client.quit();
