/**
 * SOLUTION 2 - A coupon code that expires
 * Run: node exercises/solutions/ex2_coupon.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

await client.del('coupon:asha');

// TODO 1: EX: 4 tells Redis to delete the key by itself after 4 seconds.
await client.set('coupon:asha', 'SAVE20', { EX: 4 });

// TODO 2: GET reads the value, TTL reads the time left.
console.log('Coupon:', await client.get('coupon:asha'));         // SAVE20
console.log('Seconds left:', await client.ttl('coupon:asha'));   // 4

console.log('Waiting 5 seconds...');
await wait(5);

// TODO 3: nobody deleted it - Redis removed it when the time ran out.
console.log('Coupon now:', await client.get('coupon:asha'));     // null
console.log('Does it exist?', await client.exists('coupon:asha')); // 0

await client.quit();
