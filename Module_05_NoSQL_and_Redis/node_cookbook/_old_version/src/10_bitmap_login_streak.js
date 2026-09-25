/**
 * 10 · BITMAP · Daily active users and login streaks
 * ---------------------------------------------------------------------
 * Use case    "Which customers logged in on at least 20 days this year?"
 *             "Who used both the app and net banking in September?"
 * Structure   Bitmap - a String addressed one bit at a time. One bit per
 *             customer per day: 365 days = 46 bytes per customer per year.
 * Commands    SETBIT · GETBIT · BITCOUNT · BITPOS · BITOP
 * Why Redis   50 million customers x 365 days is 2.3 GB of bits, and the
 *             questions above are answered by the CPU's popcount
 *             instruction rather than by a table scan.
 * Two layouts (a) key per customer, bit per day  → per-customer questions
 *             (b) key per day, bit per customer  → per-day questions
 * Run         node src/10_bitmap_login_streak.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const yearKey = (acct) => `icici:login:${acct}:2026`;   // layout (a)
const dayKey = (day) => `icici:dau:app:2026-09-${String(day).padStart(2, '0')}`; // layout (b)

const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86_400_000);

async function recordLogin(client, acct, date = new Date()) {
  return client.setBit(yearKey(acct), dayOfYear(date), 1);
}

async function recipe(client) {
  banner('10', 'Bitmap', 'Daily active users and login streaks');
  await reset(client, 'icici:login:*');
  await reset(client, 'icici:dau:*');

  /* -------------------- layout (a): one key per customer ---------- */
  step('Customer 9003 logs in on 40 scattered days this year');
  const loginDays = [];
  for (let d = 1; d <= 265; d += 1) {
    if (d % 7 === 3 || d % 11 === 0) {
      await client.setBit(yearKey(9003), d, 1);
      loginDays.push(d);
    }
  }
  cmd(`SETBIT ${yearKey(9003)} <day-of-year> 1`, `x${loginDays.length}`);

  step('How many days active this year?');
  const active = await client.bitCount(yearKey(9003));
  cmd(`BITCOUNT ${yearKey(9003)}`, active);
  say('One instruction per 64 days. No rows, no GROUP BY, no index.');

  step('Active in September (day 244 to 273)?');
  const sept = await client.bitCount(yearKey(9003), { start: 244, end: 273, mode: 'BIT' });
  cmd(`BITCOUNT ${yearKey(9003)} 244 273 BIT`, sept);
  say('BIT ranges arrived in Redis 7. Before that the range was in BYTES,');
  say('which made "between these two dates" awkward - worth knowing if you');
  say('meet a 6.x instance.');

  step('Did they log in today, and when did they first log in?');
  cmd(`GETBIT ${yearKey(9003)} 100`, await client.getBit(yearKey(9003), 100));
  cmd(`BITPOS ${yearKey(9003)} 1`, `day ${await client.bitPos(yearKey(9003), 1)}`);

  step('What a year of login history costs');
  const bytes = await client.memoryUsage(yearKey(9003));
  cmd(`MEMORY USAGE ${yearKey(9003)}`, `${bytes} bytes`);
  say(`${bytes} bytes per customer per year. For 50 million customers that is`);
  say(`about ${((bytes * 50_000_000) / 1024 ** 3).toFixed(1)} GB - for every login event of the year.`);

  /* -------------------- layout (b): one key per day --------------- */
  step('Flip the layout: one key per day, one bit per customer');
  for (const day of [20, 21, 22]) {
    const m = client.multi();
    for (let cust = 0; cust < 5_000; cust += 1) {
      if ((cust + day) % 3 === 0) m.setBit(dayKey(day), cust, 1);
    }
    await m.exec();
  }
  for (const day of [20, 21, 22]) {
    cmd(`BITCOUNT ${dayKey(day)}`, `${await client.bitCount(dayKey(day))} daily active users`);
  }

  step('Customers active on ALL THREE days - retention, in one command');
  await client.bitOp('AND', 'icici:dau:app:sticky', [dayKey(20), dayKey(21), dayKey(22)]);
  const sticky = await client.bitCount('icici:dau:app:sticky');
  cmd('BITOP AND icici:dau:app:sticky <three day keys>', 'OK');
  cmd('BITCOUNT icici:dau:app:sticky', sticky);
  say('BITOP AND / OR / XOR / NOT turn cohort questions into bit arithmetic.');
  say('OR across 30 day-keys gives monthly active users; XOR gives churn.');

  takeaway(
    'One bit per subject per period. BITCOUNT answers "how many", BITOP '
    + 'answers "which cohort", and the whole year costs 46 bytes per customer.',
  );
}

main(recipe);
