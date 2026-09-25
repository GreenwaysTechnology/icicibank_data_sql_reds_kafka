/**
 * SOLUTION 5 - A class test
 * Run: node exercises/solutions/ex5_class_test.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

await client.del('test:submitted');
await client.del('test:marks');

/* ---------- Part A: the Set ---------- */

// TODO 1: SADD can take a list of values.
await client.sAdd('test:submitted', ['asha', 'ravi', 'meera']);

// TODO 2: SADD returns 1 for a new value and 0 if it was already there.
// That 0 is how you know it is a duplicate - you do not need to check first.
const again = await client.sAdd('test:submitted', 'asha');
console.log('Adding asha again returns:', again);                 // 0

// TODO 3: SCARD counts the members.
console.log('Students submitted:', await client.sCard('test:submitted'));   // 3

// TODO 4: SISMEMBER answers 1 for yes, 0 for no.
console.log('Did kiran submit?', await client.sIsMember('test:submitted', 'kiran')); // 0

/* ---------- Part B: the Sorted Set ---------- */

// TODO 5: every value carries a score, and Redis keeps them sorted.
await client.zAdd('test:marks', [
  { score: 72, value: 'asha' },
  { score: 88, value: 'ravi' },
  { score: 65, value: 'meera' },
]);

// TODO 6: REV: true means highest first. 0 to 1 is the first two.
const top2 = await client.zRangeWithScores('test:marks', 0, 1, { REV: true });
console.log('Top 2:', top2.map((s) => s.value + ' ' + s.score).join(' / '));
// ravi 88 / asha 72

// TODO 7: ZINCRBY adds to the score and returns the new total.
// Redis re-sorts the list straight away.
const ravi = await client.zIncrBy('test:marks', 5, 'ravi');
console.log('Ravi after re-check:', ravi);                        // 93

await client.quit();
