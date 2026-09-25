/**
 * 04 - LIST - The last 5 songs you played
 *
 * Idea     : Keep a "recent items" list that never grows past 5.
 * Type     : List (an ordered list of values, like an array)
 * Commands : LPUSH, LRANGE, LTRIM, LLEN, LINDEX
 * Run      : node src/04_list_recent_songs.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Last 5 songs played ---');

await client.del('recent:songs');

// LPUSH puts a value at the FRONT (the left side) of the list.
// So the newest song is always first.
await client.lPush('recent:songs', 'Song A');
await client.lPush('recent:songs', 'Song B');
await client.lPush('recent:songs', 'Song C');

// LRANGE 0 -1 means "from the first item to the last item" = everything.
console.log('List now:', await client.lRange('recent:songs', 0, -1));
// [ 'Song C', 'Song B', 'Song A' ]

console.log('');
console.log('--- Play four more songs ---');

await client.lPush('recent:songs', 'Song D');
await client.lPush('recent:songs', 'Song E');
await client.lPush('recent:songs', 'Song F');
await client.lPush('recent:songs', 'Song G');

console.log('Songs stored:', await client.lLen('recent:songs'));   // 7
console.log('List now:', await client.lRange('recent:songs', 0, -1));

console.log('');
console.log('--- Keep only the newest 5 ---');

// LTRIM keeps positions 0 to 4 and throws the rest away.
await client.lTrim('recent:songs', 0, 4);

console.log('Songs stored:', await client.lLen('recent:songs'));   // 5
console.log('List now:', await client.lRange('recent:songs', 0, -1));
// [ 'Song G', 'Song F', 'Song E', 'Song D', 'Song C' ]

console.log('');
// LINDEX reads one position. 0 is the first, -1 is the last.
console.log('Newest song :', await client.lIndex('recent:songs', 0));   // Song G
console.log('Oldest kept :', await client.lIndex('recent:songs', -1));  // Song C

console.log('');
console.log('The pattern is always the same:');
console.log('  LPUSH to add the new item, then LTRIM to cut the list back to size.');
console.log('  The list can never grow out of control, and you never run a cleanup job.');

await client.quit();
