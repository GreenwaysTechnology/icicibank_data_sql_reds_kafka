/**
 * 09 - HYPERLOGLOG - Counting unique visitors
 *
 * Idea     : You want "how many DIFFERENT people visited today?"
 *            A Set would store every name. A HyperLogLog stores almost
 *            nothing and still gives a very close answer.
 * Type     : HyperLogLog (a counter of unique things)
 * Commands : PFADD, PFCOUNT, PFMERGE
 * Run      : node src/09_hll_unique_visitors.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Counting unique visitors ---');

await client.del('visitors:monday');
await client.del('visitors:tuesday');
await client.del('visitors:both');

// PFADD works like SADD - you just add the visitor's name.
await client.pfAdd('visitors:monday', 'asha');
await client.pfAdd('visitors:monday', 'ravi');
await client.pfAdd('visitors:monday', 'asha');    // same person again
await client.pfAdd('visitors:monday', 'meera');

// PFCOUNT gives the number of DIFFERENT names added.
console.log('Monday unique visitors:', await client.pfCount('visitors:monday'));  // 3

console.log('');
console.log('--- Add 1000 more visitors ---');

for (let i = 1; i <= 1000; i++) {
  await client.pfAdd('visitors:monday', 'user' + i);
}

console.log('Monday unique visitors:', await client.pfCount('visitors:monday'));
console.log('(The real answer is 1003. HyperLogLog may be off by about 1%.)');

console.log('');
console.log('--- Joining two days together ---');

await client.pfAdd('visitors:tuesday', ['asha', 'kiran', 'rahul']);
console.log('Tuesday unique visitors:', await client.pfCount('visitors:tuesday')); // 3

// PFMERGE joins several HyperLogLogs into one.
// Asha visited on both days, so she is counted only once.
await client.pfMerge('visitors:both', ['visitors:monday', 'visitors:tuesday']);
console.log('Monday + Tuesday       :', await client.pfCount('visitors:both'));

console.log('');
console.log('--- Why not just use a Set? ---');
console.log('A Set of 1 million visitor names uses several megabytes.');
console.log('A HyperLogLog uses about 12 KB - no matter how many names you add.');
console.log('');
console.log('The trade-off:');
console.log('  Set          : exact count, but you pay memory for every name.');
console.log('  HyperLogLog  : about 99% accurate, tiny memory, but you CANNOT');
console.log('                 ask "was asha here?" - it does not keep the names.');

await client.quit();
