/**
 * EXERCISE 6 - Only 2 downloads per user
 *
 * Learn from : src/08_string_rate_limit.js
 * Run        : node exercises/ex6_download_limit.js
 *
 * YOUR TASK
 *   Write the function canDownload(user).
 *   A user may download 2 files every 5 seconds. After that, say no.
 *   The counter must reset by itself - no cleanup code.
 *
 *   1. INCR the key 'downloads:<user>' and keep the number it returns.
 *   2. If that number is 1, this is the first download, so set the key
 *      to expire after 5 seconds.
 *   3. Return true if the number is 2 or less, otherwise false.
 *   4. After the wait, show that the user can download again.
 *
 * EXPECTED OUTPUT
 *   Download 1 -> allowed
 *   Download 2 -> allowed
 *   Download 3 -> BLOCKED
 *   Waiting 6 seconds...
 *   Download 4 -> allowed
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

  // TODO 1: INCR the key and keep the returned number


  // TODO 2: if it is the first download, set the expiry


  // TODO 3: return true or false
  return false;   // <- replace this
}

await client.del('downloads:asha');

for (let i = 1; i <= 3; i++) {
  const ok = await canDownload('asha');
  console.log('Download', i, '->', ok ? 'allowed' : 'BLOCKED');
}

console.log('Waiting 6 seconds...');
await wait(WINDOW + 1);

const ok = await canDownload('asha');
console.log('Download 4 ->', ok ? 'allowed' : 'BLOCKED');

await client.del('downloads:asha');
await client.quit();
