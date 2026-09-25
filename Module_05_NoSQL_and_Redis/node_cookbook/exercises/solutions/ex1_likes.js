/**
 * SOLUTION 1 - Count likes on posts
 * Run: node exercises/solutions/ex1_likes.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

await client.del('post:1');
await client.del('post:2');
await client.del('post:3');

// TODO 1: INCR adds 1 each time. The key starts at 0 on its own.
await client.incr('post:1');
await client.incr('post:1');
await client.incr('post:1');

// TODO 2: INCRBY adds any amount in a single command.
await client.incrBy('post:2', 5);

console.log('post:1 likes =', await client.get('post:1'));   // 3
console.log('post:2 likes =', await client.get('post:2'));   // 5

// TODO 3: MGET reads several keys in one trip to the server.
const both = await client.mGet(['post:1', 'post:2']);
console.log('both posts   =', both);                         // [ '3', '5' ]

// TODO 4: a key that does not exist reads back as null.
// Show it as 0 in your app - do not let it crash.
console.log('post:3 likes =', await client.get('post:3'));   // null

await client.quit();
