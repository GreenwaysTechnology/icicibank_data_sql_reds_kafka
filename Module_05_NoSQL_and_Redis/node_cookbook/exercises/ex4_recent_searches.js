/**
 * EXERCISE 4 - The last 3 searches
 *
 * Learn from : src/04_list_recent_songs.js
 * Run        : node exercises/ex4_recent_searches.js
 *
 * YOUR TASK
 *   A user searches for 5 things, one after another.
 *   Keep only the newest 3, with the newest one first.
 *
 *   1. Add all 5 searches to the list recent:searches (newest at the front).
 *   2. Cut the list down to 3 items.
 *   3. Print the list and its length.
 *   4. Print the newest search on its own.
 *
 * EXPECTED OUTPUT
 *   List: [ 'laptop', 'headphones', 'shoes' ]
 *   Length: 3
 *   Newest search: laptop
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

const searches = ['pen', 'notebook', 'shoes', 'headphones', 'laptop'];

await client.del('recent:searches');

// TODO 1: add each search to the FRONT of the list (use LPUSH in a loop)
for (const word of searches) {
  // ...
}

// TODO 2: keep only positions 0 to 2 (use LTRIM)


// TODO 3: print the list (use LRANGE 0 -1) and the length (use LLEN)
// console.log('List:', ...);
// console.log('Length:', ...);


// TODO 4: print only the first item (use LINDEX)
// console.log('Newest search:', ...);


await client.quit();
