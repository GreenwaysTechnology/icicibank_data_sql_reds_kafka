/**
 * 08 - STRING + TTL - "Only 3 messages per minute"
 *
 * Idea     : Count how many times a user did something. If the count goes
 *            over the limit, say no. The counter resets by itself.
 * Type     : String used as a counter, with an expiry time
 * Commands : INCR, EXPIRE, TTL, DEL
 * Run      : node src/08_string_rate_limit.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

const LIMIT = 3;         // how many messages are allowed
const WINDOW = 10;       // in how many seconds

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

/**
 * Returns true if the user is allowed to send another message.
 * This is the whole rate limiter - just two Redis commands.
 */
async function isAllowed(user) {
  const key = 'limit:' + user;

  // INCR returns the new count. That number is our answer.
  const count = await client.incr(key);

  // On the very first message, start the 10 second timer.
  if (count === 1) {
    await client.expire(key, WINDOW);
  }

  return count <= LIMIT;
}

console.log('--- Only 3 messages every 10 seconds ---');

await client.del('limit:asha');

for (let i = 1; i <= 5; i++) {
  const allowed = await isAllowed('asha');
  console.log('Message', i, '->', allowed ? 'sent' : 'BLOCKED (too many)');
}
// 1 sent, 2 sent, 3 sent, 4 BLOCKED, 5 BLOCKED

console.log('');
console.log('Counter value now :', await client.get('limit:asha'));   // 5
console.log('Resets in         :', await client.ttl('limit:asha'), 'seconds');

console.log('');
console.log('Waiting for the counter to expire...');
await wait(WINDOW + 1);

console.log('Counter value now :', await client.get('limit:asha'));   // null
console.log('The key expired, so the user starts fresh.');

const allowedAgain = await isAllowed('asha');
console.log('Message 6 ->', allowedAgain ? 'sent' : 'BLOCKED');       // sent

await client.del('limit:asha');

console.log('');
console.log('This is how websites stop someone from spamming a form,');
console.log('asking for OTPs again and again, or hammering an API.');

await client.quit();
