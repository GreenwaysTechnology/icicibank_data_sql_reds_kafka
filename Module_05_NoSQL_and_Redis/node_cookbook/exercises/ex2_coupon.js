/**
 * EXERCISE 2 - A coupon code that expires
 *
 * Learn from : src/02_string_expiry.js
 * Run        : node exercises/ex2_coupon.js
 *
 * YOUR TASK
 *   1. Save the coupon code "SAVE20" under the key coupon:asha,
 *      and make it expire after 4 seconds.
 *   2. Print the code and how many seconds are left.
 *   3. Wait 5 seconds (use the wait() helper below).
 *   4. Print the code again and show that it is gone.
 *
 * EXPECTED OUTPUT
 *   Coupon: SAVE20
 *   Seconds left: 4
 *   Waiting 5 seconds...
 *   Coupon now: null
 *   Does it exist? 0
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

await client.del('coupon:asha');

// TODO 1: save 'SAVE20' with an expiry of 4 seconds
//         hint: client.set(key, value, { EX: 4 })


// TODO 2: print the coupon and the seconds left (use GET and TTL)
// console.log('Coupon:', ...);
// console.log('Seconds left:', ...);


console.log('Waiting 5 seconds...');
await wait(5);

// TODO 3: print the coupon again, and use EXISTS to show it is gone
// console.log('Coupon now:', ...);
// console.log('Does it exist?', ...);


await client.quit();
