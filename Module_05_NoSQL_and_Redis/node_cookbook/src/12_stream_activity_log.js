/**
 * 12 - STREAM - An activity log
 *
 * Idea     : Keep a list of things that happened, in order, each with a
 *            time stamp. Like a diary that only gets added to.
 * Type     : Stream (an append-only log of entries)
 * Commands : XADD, XLEN, XRANGE, XREAD
 * Run      : node src/12_stream_activity_log.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- An activity log ---');

await client.del('activity');

// XADD adds one entry.
// The '*' tells Redis "give this entry an id based on the current time".
// The last part is the data, written as field -> value pairs.
const id1 = await client.xAdd('activity', '*', { user: 'asha', action: 'login' });
console.log('Entry 1 id:', id1);

await client.xAdd('activity', '*', { user: 'ravi', action: 'login' });
await client.xAdd('activity', '*', { user: 'asha', action: 'uploaded-photo' });
await client.xAdd('activity', '*', { user: 'asha', action: 'logout' });

console.log('Entries in the log:', await client.xLen('activity'));   // 4

console.log('');
console.log('--- Read the whole log ---');

// XRANGE reads entries. '-' means "from the very start",
// '+' means "up to the very end".
const all = await client.xRange('activity', '-', '+');

for (const entry of all) {
  console.log(entry.id, '=>', entry.message);
}
// 1790071512163-0 => { user: 'asha', action: 'login' }
// ...

console.log('');
console.log('--- Understanding the id ---');

// An id looks like 1790071512163-0
//   1790071512163 = the time in milliseconds
//   0             = a counter, in case two entries land in the same millisecond
const firstPart = all[0].id.split('-')[0];
console.log('Entry 1 was added at:', new Date(Number(firstPart)).toLocaleString());

console.log('');
console.log('--- Read only what is NEW ---');

// Ask for everything after the last id we have already seen.
const lastSeen = all[all.length - 1].id;
console.log('Last id I have seen:', lastSeen);

await client.xAdd('activity', '*', { user: 'meera', action: 'login' });

const fresh = await client.xRead({ key: 'activity', id: lastSeen });
console.log('New entries since then:');
for (const entry of fresh[0].messages) {
  console.log('  ', entry.id, '=>', entry.message);
}

console.log('');
console.log('A List forgets an item once you pop it.');
console.log('A Stream keeps everything, so many readers can each read the log');
console.log('at their own speed, and nobody removes anything from anybody else.');

await client.quit();
