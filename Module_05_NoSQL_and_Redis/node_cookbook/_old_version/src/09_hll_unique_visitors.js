/**
 * 09 · HYPERLOGLOG · Unique visitors and unique card users
 * ---------------------------------------------------------------------
 * Use case    "How many distinct customers used the app today? This week?"
 *             The answer goes on a dashboard; nobody needs it exact.
 * Structure   HyperLogLog - a probabilistic counter in a fixed 12 KB.
 * Commands    PFADD · PFCOUNT · PFMERGE
 * Why Redis   Counting distinct things exactly means remembering every id
 *             you have seen. A HyperLogLog remembers none of them and is
 *             within about 0.81% - in 12 KB, whether you feed it a
 *             thousand ids or a billion.
 * Trade-off   You can never ask "is customer 9003 in there?" - the ids are
 *             not stored. If you need that, you need a Set.
 * Run         node src/09_hll_unique_visitors.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const N = 100_000;
const HLL = 'icici:uv:hll:2026-09-22';
const SET = 'icici:uv:set:2026-09-22';

async function recipe(client) {
  banner('09', 'HyperLogLog', 'Daily unique visitors');
  await reset(client, 'icici:uv:*');

  step(`Feed ${N.toLocaleString('en-IN')} customer ids into both a HLL and a Set`);
  const t0 = performance.now();
  for (let batch = 0; batch < N / 5_000; batch += 1) {
    const hll = client.multi();
    const set = client.multi();
    for (let i = 0; i < 5_000; i += 1) {
      const id = `cust:${batch * 5_000 + i}`;
      hll.pfAdd(HLL, id);
      set.sAdd(SET, id);
    }
    await Promise.all([hll.exec(), set.exec()]);
  }
  say(`loaded in ${((performance.now() - t0) / 1000).toFixed(1)}s`);

  step('The two answers');
  const approx = await client.pfCount(HLL);
  const exact = await client.sCard(SET);
  cmd(`PFCOUNT ${HLL}`, approx);
  cmd(`SCARD ${SET}`, exact);
  const errPct = (100 * Math.abs(approx - exact)) / exact;
  say(`error ${errPct.toFixed(3)}%  (the documented standard error is 0.81%)`);

  step('The two costs - this is the entire reason HyperLogLog exists');
  const hllBytes = await client.memoryUsage(HLL);
  const setBytes = await client.memoryUsage(SET);
  cmd(`MEMORY USAGE ${HLL}`, `${hllBytes.toLocaleString('en-IN')} bytes`);
  cmd(`MEMORY USAGE ${SET}`, `${setBytes.toLocaleString('en-IN')} bytes`);
  say(`the Set costs ${Math.round(setBytes / hllBytes)}x more, and it grows with every new id;`);
  say('the HyperLogLog is capped at ~12 KB and stays there at a billion ids.');

  step('Weekly uniques - and why you cannot just add the daily numbers');
  const days = [];
  for (let d = 16; d <= 22; d += 1) {
    const key = `icici:uv:hll:2026-09-${d}`;
    days.push(key);
    const m = client.multi();
    // Each day sees an overlapping slice of the same customer base.
    for (let i = 0; i < 20_000; i += 1) m.pfAdd(key, `cust:${(d * 7_000 + i) % 60_000}`);
    await m.exec();
  }
  const daily = [];
  for (const key of days) daily.push(await client.pfCount(key));
  say(`  daily counts: ${daily.join(', ')}`);
  say(`  naive sum   : ${daily.reduce((a, b) => a + b, 0).toLocaleString('en-IN')}  ← wrong, double-counts`);

  await client.pfMerge('icici:uv:hll:week-38', days);
  const week = await client.pfCount('icici:uv:hll:week-38');
  cmd('PFMERGE icici:uv:hll:week-38 <7 daily keys>', 'OK');
  cmd('PFCOUNT icici:uv:hll:week-38', week.toLocaleString('en-IN'));
  say('PFMERGE unions the registers, so a customer who visited on five days');
  say('is still counted once. This is the feature that makes HLLs usable for');
  say('rollups: day → week → month, with no re-scan of the raw events.');

  step('PFCOUNT over several keys does the same thing without storing a merge');
  cmd(`PFCOUNT ${days.slice(0, 3).join(' ')}`, await client.pfCount(days.slice(0, 3)));

  takeaway(
    'Distinct-count on a dashboard is a HyperLogLog: fixed 12 KB, ~0.8% error, '
    + 'and PFMERGE for rollups. Use a Set only when you must ask about a '
    + 'specific member.',
  );
}

main(recipe);
