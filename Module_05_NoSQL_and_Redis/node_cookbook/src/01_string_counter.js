/**
 * 01 - STRING - Counting page views
 *
 * Idea     : Every time someone opens a page, add 1 to a counter.
 * Type     : String (Redis can use a String as a number)
 * Commands : DEL, INCR, INCRBY, GET, MGET
 * Run      : node src/01_string_counter.js
 */
import { createClient } from 'redis';

// Connect to Redis on this computer (localhost, port 6379).
// reconnectStrategy: false means "if Redis is off, stop instead of retrying forever".
const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Counting page views ---');

// Start clean, so you can run this file as many times as you like.
await client.del('views:home');
await client.del('views:about');

// INCR adds 1 to the number stored in the key.
// The key did not exist, so Redis starts it at 0 and then adds 1.
await client.incr('views:home');
await client.incr('views:home');
await client.incr('views:home');

const homeViews = await client.get('views:home');
console.log('views:home =', homeViews);        // 3

// INCRBY adds any number you want, in one step.
await client.incrBy('views:about', 10);
const aboutViews = await client.get('views:about');
console.log('views:about =', aboutViews);      // 10

// MGET reads many keys at once.
const both = await client.mGet(['views:home', 'views:about']);
console.log('both pages   =', both);           // [ '3', '10' ]

// A key that does not exist reads back as null (not 0, not an error).
const missing = await client.get('views:contact');
console.log('views:contact =', missing);       // null

// IMPORTANT: Redis always gives you back a STRING, never a number.
console.log('type of homeViews:', typeof homeViews);   // string
console.log('as a number:', Number(homeViews) + 1);    // 4

console.log('');
console.log('Why INCR is useful:');
console.log('  Even if 100 users open the page at the exact same moment,');
console.log('  Redis does one INCR at a time, so no count is ever lost.');

await client.quit();
