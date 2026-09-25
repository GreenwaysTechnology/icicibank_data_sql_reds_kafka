/**
 * Exercise 9 — dashboard.js
 * One report, four structures, each chosen for the question it answers.
 *
 *   node exercises/ex09_dashboard.js
 */
import { main, banner, step, say, takeaway, reset } from '../src/_client.js';

const MONTH = '2026-09';
const DAYS = ['16', '17', '18', '19', '20', '21', '22'];
const TODAY = DAYS.at(-1);

const BOARD = `icici:lb:branch:${MONTH}`;
const uvKey = (d) => `icici:uv:${MONTH}-${d}`;        // HyperLogLog, per day
const dauKey = (d) => `icici:dau:${MONTH}-${d}`;      // Bitmap, per day
const BRANCHES = 20;
const CUSTOMERS = 5_000;

const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');

async function seed(client) {
  await reset(client, 'icici:lb:*');
  await reset(client, 'icici:uv:*');
  await reset(client, 'icici:dau:*');

  // Branch volumes - Sorted Set
  const board = client.multi();
  for (let i = 1; i <= BRANCHES; i += 1) {
    const code = `BR-${['MUM', 'DEL', 'BLR', 'CHN', 'PNQ'][i % 5]}-${String(i).padStart(3, '0')}`;
    board.zAdd(BOARD, { score: 50_000 + ((i * 97_003) % 400_000), value: code });
  }
  board.zAdd(BOARD, { score: 322_000, value: 'BR-CHN-009' });
  await board.exec();

  // Logins - HyperLogLog per day, Bitmap per day
  for (const d of DAYS) {
    const m = client.multi();
    for (let c = 0; c < CUSTOMERS; c += 1) {
      // A slice of the base each day; every third customer comes every day.
      const active = c % 3 === 0 || (c + Number(d)) % 4 === 0;
      if (active) {
        m.pfAdd(uvKey(d), `cust:${c}`);
        m.setBit(dauKey(d), c, 1);
      }
    }
    await m.exec();
  }
}

async function recipe(client) {
  banner('EX09', 'ZSet + HLL + Bitmap', 'One dashboard, four structures');

  step('Seeding 30 days of activity');
  await seed(client);
  say(`${BRANCHES} branches · ${CUSTOMERS} customers · ${DAYS.length} days`);

  // (a) Sorted Set - ranking and "where am I", both O(log n)
  const top = await client.zRangeWithScores(BOARD, 0, 4, { REV: true });
  const rank = await client.zRevRank(BOARD, 'BR-CHN-009');
  const score = await client.zScore(BOARD, 'BR-CHN-009');
  const total = await client.zCard(BOARD);

  // (b) HyperLogLog - PFCOUNT over several keys unions them, so nobody is
  //     counted twice. Summing the daily figures would be wrong.
  const today = await client.pfCount(uvKey(TODAY));
  const week = await client.pfCount(DAYS.map(uvKey));
  const naive = (await Promise.all(DAYS.map((d) => client.pfCount(uvKey(d)))))
    .reduce((a, b) => a + b, 0);

  // (c) Bitmap - "active every day" is bit arithmetic
  await client.bitOp('AND', 'icici:dau:sticky', DAYS.map(dauKey));
  const retained = await client.bitCount('icici:dau:sticky');

  // (d) what the whole dashboard costs
  const keys = [BOARD, ...DAYS.map(uvKey), ...DAYS.map(dauKey)];
  let bytes = 0;
  for (const k of keys) bytes += await client.memoryUsage(k);

  step('The report');
  const L = (s) => console.log('    ' + s);
  L('');
  L(`  ICICI · WEST REGION · ${MONTH}-${TODAY}`);
  L('  ' + '─'.repeat(45));
  L('  TOP BRANCHES          MTD VOLUME');
  top.forEach((row, i) => {
    L(`   ${i + 1}. ${row.value.padEnd(16)} ${inr(row.score).padStart(12)}`);
  });
  L('');
  L(`  BR-CHN-009 is #${rank + 1} of ${total} with ${inr(score)}`);
  L('');
  L(`  unique customers today       ${today.toLocaleString('en-IN').padStart(8)}`);
  L(`  unique customers this week   ${week.toLocaleString('en-IN').padStart(8)}`);
  L(`  active every day this week   ${retained.toLocaleString('en-IN').padStart(8)}`);
  L(`  dashboard keyspace           ${(bytes / 1024).toFixed(1).padStart(8)} KB`);
  L('');

  step('Why the weekly figure is not the sum of the days');
  say(`  sum of the seven daily counts: ${naive.toLocaleString('en-IN')}`);
  say(`  PFCOUNT over the seven keys  : ${week.toLocaleString('en-IN')}`);
  say('  The difference is everyone who came back. PFCOUNT unions the registers');
  say('  first; PFMERGE into a weekly key does the same thing and stores it.');

  step('Would this design hold at ICICI scale?');
  say(`  leaderboard   one key, ${total} members`);
  say('  HyperLogLogs  12 KB per day whatever the traffic');
  say('  bitmaps       one bit per customer per day → 50M customers = 6 MB/day');
  say('  The dashboard costs kilobytes and does not grow with transaction volume -');
  say('  only with the number of customers and the days retained.');

  takeaway(
    'Ranking → Sorted Set · distinct counts → HyperLogLog · "on which days" → '
    + 'Bitmap. Choosing right is most of the work; the commands are the easy part.',
  );
}

main(recipe);
