/**
 * 05 - LIST as a QUEUE - Pizza orders
 *
 * Idea     : Customers add orders at one end. The kitchen takes them from
 *            the other end. First order in, first order out.
 * Type     : List used as a queue
 * Commands : RPUSH, LPOP, LLEN, LRANGE
 * Run      : node src/05_list_order_queue.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Pizza order queue ---');

await client.del('orders');

// Three customers place orders.
// RPUSH adds to the RIGHT (the back of the queue), like joining a line.
await client.rPush('orders', 'Margherita');
await client.rPush('orders', 'Farmhouse');
await client.rPush('orders', 'Peppy Paneer');

console.log('Waiting orders:', await client.lRange('orders', 0, -1));
// [ 'Margherita', 'Farmhouse', 'Peppy Paneer' ]
console.log('How many      :', await client.lLen('orders'));   // 3

console.log('');
console.log('--- The kitchen starts cooking ---');

// LPOP takes from the LEFT (the front of the queue) and removes it.
const first = await client.lPop('orders');
console.log('Cooking:', first);                                 // Margherita

const second = await client.lPop('orders');
console.log('Cooking:', second);                                // Farmhouse

console.log('Still waiting:', await client.lRange('orders', 0, -1));
// [ 'Peppy Paneer' ]

console.log('');
console.log('--- A new order arrives while cooking ---');

await client.rPush('orders', 'Veg Extravaganza');
console.log('Queue now:', await client.lRange('orders', 0, -1));
// [ 'Peppy Paneer', 'Veg Extravaganza' ]

console.log('');
console.log('--- Empty the queue ---');

// LPOP returns null when the list is empty, so this loop ends on its own.
let order = await client.lPop('orders');
while (order !== null) {
  console.log('Cooking:', order);
  order = await client.lPop('orders');
}

console.log('Queue length now:', await client.lLen('orders'));   // 0

console.log('');
console.log('RPUSH + LPOP = a queue (first in, first out).');
console.log('This is how background jobs are shared between many workers:');
console.log('one process adds work, another picks it up.');

await client.quit();
