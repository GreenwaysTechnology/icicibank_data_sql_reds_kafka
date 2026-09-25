/**
 * EXERCISE 1 - Count likes on posts
 *
 * Learn from : src/01_string_counter.js
 * Run        : node exercises/ex1_likes.js
 *
 * YOUR TASK
 *   1. Give post:1 three likes.
 *   2. Give post:2 five likes, using ONE command (not five).
 *   3. Read both counts in ONE command.
 *   4. Read the likes for post:3, which nobody has liked yet.
 *
 * EXPECTED OUTPUT
 *   post:1 likes = 3
 *   post:2 likes = 5
 *   both posts   = [ '3', '5' ]
 *   post:3 likes = null
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

await client.del('post:1');
await client.del('post:2');
await client.del('post:3');

// TODO 1: add 1 like to post:1, three times (use INCR)


// TODO 2: add 5 likes to post:2 in one command (use INCRBY)


console.log('post:1 likes =', await client.get('post:1'));
console.log('post:2 likes =', await client.get('post:2'));

// TODO 3: read post:1 and post:2 together (use MGET) and print the result
// console.log('both posts   =', ...);


// TODO 4: read post:3 and print it. What does Redis give you for a key
//         that was never created?
// console.log('post:3 likes =', ...);


await client.quit();
