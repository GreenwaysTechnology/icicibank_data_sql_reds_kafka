/**
 * EXERCISE 5 - A class test
 *
 * Learn from : src/06_set_quiz_attempts.js and src/07_zset_game_scores.js
 * Run        : node exercises/ex5_class_test.js
 *
 * YOUR TASK
 *   Part A - use a SET to track who submitted the test.
 *     1. Add asha, ravi and meera to test:submitted.
 *     2. Try to add asha a second time and print what SADD returns.
 *     3. Print how many students submitted.
 *     4. Check whether kiran submitted.
 *
 *   Part B - use a SORTED SET for the marks.
 *     5. Add asha 72, ravi 88, meera 65 to test:marks.
 *     6. Print the top 2 students with their marks.
 *     7. Ravi's answer was re-checked - add 5 marks to him.
 *     8. Print his new total.
 *
 * EXPECTED OUTPUT
 *   Adding asha again returns: 0
 *   Students submitted: 3
 *   Did kiran submit? 0
 *   Top 2: ravi 88 / asha 72
 *   Ravi after re-check: 93
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

await client.del('test:submitted');
await client.del('test:marks');

/* ---------- Part A: the Set ---------- */

// TODO 1: add the three names (use SADD)


// TODO 2: add asha again and print the number SADD gives back
// console.log('Adding asha again returns:', ...);


// TODO 3: print how many students are in the set (use SCARD)
// console.log('Students submitted:', ...);


// TODO 4: check whether kiran is in the set (use SISMEMBER)
// console.log('Did kiran submit?', ...);


/* ---------- Part B: the Sorted Set ---------- */

// TODO 5: add the three marks
//         hint: client.zAdd('test:marks', [{ score: 72, value: 'asha' }, ...])


// TODO 6: print the top 2, highest first
//         hint: client.zRangeWithScores('test:marks', 0, 1, { REV: true })


// TODO 7: add 5 marks to ravi (use ZINCRBY) and print his new total
// console.log('Ravi after re-check:', ...);


await client.quit();
