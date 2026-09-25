/**
 * 07 · SORTED SET · Branch leaderboard, live
 * ---------------------------------------------------------------------
 * Use case    A wallboard in the regional office ranking branches by
 *             month-to-date transaction volume, updated on every payment.
 * Structure   Sorted Set - every member carries a score, and Redis keeps
 *             the whole thing ordered by that score at all times.
 * Commands    ZADD · ZINCRBY · ZRANGE ... REV WITHSCORES · ZREVRANK
 *             ZSCORE · ZRANGEBYSCORE · ZCOUNT · ZREMRANGEBYRANK
 * Why Redis   "Top 10 of 4,000 branches" is O(log n + 10) here and needs no
 *             ORDER BY over the transaction table. The ranking is never
 *             stale because it is updated by the write itself.
 * Run         node src/07_zset_branch_leaderboard.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const month = '2026-09';
const BOARD = `icici:lb:branch:${month}`;

/** Called from the payment path. Never reads the old value. */
async function recordVolume(client, branch, amount) {
  return client.zIncrBy(BOARD, amount, branch);
}

async function recipe(client) {
  banner('07', 'Sorted Set', 'Live branch leaderboard');
  await reset(client, 'icici:lb:*');

  step('Seed the month');
  await client.zAdd(BOARD, [
    { score: 250_000, value: 'BR-MUM-014' },
    { score: 410_000, value: 'BR-DEL-002' },
    { score: 185_000, value: 'BR-BLR-031' },
    { score: 322_000, value: 'BR-CHN-009' },
    { score: 96_500, value: 'BR-PNQ-007' },
  ]);
  cmd(`ZADD ${BOARD} 250000 BR-MUM-014 410000 BR-DEL-002 ...`, '(integer) 5');

  step('A ₹90,000 transaction posts at BR-MUM-014');
  const updated = await recordVolume(client, 'BR-MUM-014', 90_000);
  cmd(`ZINCRBY ${BOARD} 90000 BR-MUM-014`, updated);
  say('ZINCRBY is read-modify-write inside Redis. The application never reads');
  say('the old score, so two branches posting at once cannot clobber each other.');

  step('The wallboard: top three, highest first');
  const top = await client.zRangeWithScores(BOARD, 0, 2, { REV: true });
  cmd(`ZRANGE ${BOARD} 0 2 REV WITHSCORES`, '');
  top.forEach((row, i) => {
    say(`  ${i + 1}. ${row.value.padEnd(12)} ₹${Number(row.score).toLocaleString('en-IN')}`);
  });
  say('The sort already happened - on every ZINCRBY, incrementally.');

  step('"Where am I?" - the question every branch manager asks');
  const rank = await client.zRevRank(BOARD, 'BR-CHN-009');
  const score = await client.zScore(BOARD, 'BR-CHN-009');
  const total = await client.zCard(BOARD);
  cmd(`ZREVRANK ${BOARD} BR-CHN-009`, rank);
  cmd(`ZSCORE ${BOARD} BR-CHN-009`, score);
  say(`BR-CHN-009 is #${rank + 1} of ${total} with ₹${Number(score).toLocaleString('en-IN')}`);
  say('Rank is 0-based. O(log n) - it does not scan the other 3,999 branches.');

  step('Branches between ₹200,000 and ₹400,000 - the middle band');
  const band = await client.zRangeByScore(BOARD, 200_000, 400_000);
  const bandCount = await client.zCount(BOARD, 200_000, 400_000);
  cmd(`ZRANGEBYSCORE ${BOARD} 200000 400000`, band);
  cmd(`ZCOUNT ${BOARD} 200000 400000`, bandCount);
  say('Range-by-score is what makes a Sorted Set a time-series index too:');
  say('use a timestamp as the score and this becomes "everything since 09:00".');

  step('Keep the board bounded - drop everyone outside the top 100');
  const removed = await client.zRemRangeByRank(BOARD, 0, -101);
  cmd(`ZREMRANGEBYRANK ${BOARD} 0 -101`, `${removed} removed (only 5 members here)`);
  say('Ranks 0..-101 are everything except the last 100 by score, i.e. the');
  say('bottom of the table. Run it nightly and memory is capped forever.');

  step('Cost');
  cmd(`OBJECT ENCODING ${BOARD}`, await client.objectEncoding(BOARD));
  cmd(`MEMORY USAGE ${BOARD}`, `${await client.memoryUsage(BOARD)} bytes`);
  say('Small sorted sets are listpacks; past the threshold Redis switches to');
  say('a skip list plus a hash table - which is why both ZSCORE (by member)');
  say('and ZRANGE (by rank) are fast on the same structure.');

  takeaway(
    'Anything phrased as "top N", "rank of", "between X and Y" or "leaderboard" '
    + 'is a Sorted Set. Update it with ZINCRBY from the write path and it is '
    + 'never stale.',
  );
}

main(recipe);
