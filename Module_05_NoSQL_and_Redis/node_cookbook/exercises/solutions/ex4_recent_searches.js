/**
 * SOLUTION 4 - The last 3 searches
 * Run: node exercises/solutions/ex4_recent_searches.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

const searches = ['pen', 'notebook', 'shoes', 'headphones', 'laptop'];

await client.del('recent:searches');

// TODO 1: LPUSH puts each new search at the front, so the newest ends up first.
for (const word of searches) {
  await client.lPush('recent:searches', word);
}

// TODO 2: LTRIM keeps positions 0, 1 and 2 and throws the rest away.
await client.lTrim('recent:searches', 0, 2);

// TODO 3: 0 to -1 means "the whole list".
console.log('List:', await client.lRange('recent:searches', 0, -1));
// [ 'laptop', 'headphones', 'shoes' ]
console.log('Length:', await client.lLen('recent:searches'));   // 3

// TODO 4: LINDEX 0 is the first item.
console.log('Newest search:', await client.lIndex('recent:searches', 0));  // laptop

// The pattern to remember: LPUSH to add, LTRIM to keep the list small.
await client.quit();
