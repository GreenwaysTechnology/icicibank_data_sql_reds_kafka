/**
 * 06 - SET - Who has attempted the quiz
 *
 * Idea     : A Set keeps only unique values. Add the same name twice and
 *            it is still there once. Perfect for "has this person done it?"
 * Type     : Set (unordered, no duplicates)
 * Commands : SADD, SISMEMBER, SMEMBERS, SCARD, SREM, SINTER
 * Run      : node src/06_set_quiz_attempts.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Who has attempted the quiz ---');

await client.del('quiz:attempted');

// SADD adds a value. It returns 1 if it was new, 0 if it was already there.
const added1 = await client.sAdd('quiz:attempted', 'asha');
console.log('Added asha  ->', added1);   // 1  (new)

const added2 = await client.sAdd('quiz:attempted', 'asha');
console.log('Added asha  ->', added2);   // 0  (already there - no duplicate)

await client.sAdd('quiz:attempted', 'ravi');
await client.sAdd('quiz:attempted', 'meera');

console.log('Everyone    :', await client.sMembers('quiz:attempted'));
console.log('How many    :', await client.sCard('quiz:attempted'));   // 3

console.log('');
console.log('--- Has this student attempted? ---');

// SISMEMBER answers 1 for yes and 0 for no.
// It is just as fast on a set of 5 names as on a set of 5 million.
console.log('ravi  ->', await client.sIsMember('quiz:attempted', 'ravi'));   // 1
console.log('kiran ->', await client.sIsMember('quiz:attempted', 'kiran'));  // 0

// SREM removes a member.
await client.sRem('quiz:attempted', 'ravi');
console.log('After removing ravi:', await client.sMembers('quiz:attempted'));

console.log('');
console.log('--- Comparing two sets ---');

await client.del('club:music');
await client.del('club:dance');

await client.sAdd('club:music', ['asha', 'meera', 'kiran']);
await client.sAdd('club:dance', ['meera', 'kiran', 'rahul']);

console.log('Music club:', await client.sMembers('club:music'));
console.log('Dance club:', await client.sMembers('club:dance'));

// SINTER = who is in BOTH sets. Redis works this out for you.
const both = await client.sInter(['club:music', 'club:dance']);
console.log('In both clubs:', both);     // [ 'meera', 'kiran' ]

console.log('');
console.log('Remember: a Set has no order and no duplicates.');
console.log('Use it for "unique things" and for "is X in this group?".');

await client.quit();
