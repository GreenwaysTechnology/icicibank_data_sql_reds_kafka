/**
 * 07 - SORTED SET - A game leaderboard
 *
 * Idea     : Each player has a score. Redis keeps them sorted for you,
 *            so "top 3 players" is instant.
 * Type     : Sorted Set (every value has a number called a score)
 * Commands : ZADD, ZINCRBY, ZRANGE (with REV), ZSCORE, ZCARD, ZREVRANK
 * Run      : node src/07_zset_game_scores.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Game leaderboard ---');

await client.del('scores:game');

// ZADD adds players with their scores.
await client.zAdd('scores:game', [
  { score: 120, value: 'asha' },
  { score: 340, value: 'ravi' },
  { score: 90, value: 'meera' },
  { score: 500, value: 'kiran' },
]);

console.log('Players:', await client.zCard('scores:game'));   // 4

// ZRANGE with REV: true gives the highest scores first.
// 0 to 2 means the first three.
const top3 = await client.zRangeWithScores('scores:game', 0, 2, { REV: true });
console.log('Top 3:');
for (const player of top3) {
  console.log('   ', player.value, '-', player.score);
}
// kiran - 500
// ravi  - 340
// asha  - 120

console.log('');
console.log('--- Asha plays again and earns 250 more points ---');

// ZINCRBY adds to a score. Redis re-sorts the list immediately.
const newScore = await client.zIncrBy('scores:game', 250, 'asha');
console.log("Asha's score is now:", newScore);   // 370

const top3Again = await client.zRangeWithScores('scores:game', 0, 2, { REV: true });
console.log('Top 3 now:');
for (const player of top3Again) {
  console.log('   ', player.value, '-', player.score);
}
// kiran - 500
// asha  - 370
// ravi  - 340

console.log('');
console.log('--- Looking up one player ---');

console.log("Meera's score:", await client.zScore('scores:game', 'meera'));   // 90

// ZREVRANK gives the position counting from the HIGHEST score.
// It starts at 0, so we add 1 to show a normal position to a human.
const rank = await client.zRevRank('scores:game', 'asha');
console.log('Asha is in position:', rank + 1);   // 2

console.log('');
console.log('Why this is special:');
console.log('  You never sort anything yourself. Redis keeps the order');
console.log('  up to date on every ZADD and ZINCRBY, even with millions of players.');

await client.quit();
