/**
 * 08 · STRING + SORTED SET · API rate limiting
 * ---------------------------------------------------------------------
 * Use case    The ICICI public API allows each customer 5 calls a minute.
 *             Twenty API servers must enforce that limit together.
 * Structure   (a) String counter  - fixed window, one INCR, cheapest.
 *             (b) Sorted Set      - sliding window, exact, costs more.
 * Commands    INCR · EXPIRE NX · ZADD · ZREMRANGEBYSCORE · ZCARD
 * Why Redis   The limit is shared state. Counting in each Node process
 *             gives every server its own allowance and 20x the real limit.
 * Run         node src/08_zset_rate_limiter.js
 */
import { main, banner, step, cmd, say, takeaway, reset, sleep } from './_client.js';

const LIMIT = 5;
const WINDOW = 10; // seconds - short so the demo finishes quickly

/* ------------------------------------------------------------------ */
/* (a) Fixed window - one counter per customer per window              */
/* ------------------------------------------------------------------ */
async function allowFixed(client, customer) {
  const bucket = Math.floor(Date.now() / 1000 / WINDOW);
  const key = `icici:rl:fixed:${customer}:${bucket}`;

  // One round trip. EXPIRE ... NX arms the TTL only on the first call,
  // so a later call can never push the window's end further out.
  const [used] = await client.multi().incr(key).expire(key, WINDOW, 'NX').exec();

  return { allowed: used <= LIMIT, used, remaining: Math.max(0, LIMIT - used) };
}

/* ------------------------------------------------------------------ */
/* (b) Sliding window - one member per request, scored by timestamp    */
/* ------------------------------------------------------------------ */
async function allowSliding(client, customer) {
  const key = `icici:rl:slide:${customer}`;
  const now = Date.now();
  const cutoff = now - WINDOW * 1000;

  const replies = await client
    .multi()
    .zRemRangeByScore(key, 0, cutoff) // forget anything older than the window
    .zAdd(key, { score: now, value: `${now}-${Math.random().toString(36).slice(2, 8)}` })
    .zCard(key) // how many calls in the last WINDOW seconds
    .expire(key, WINDOW + 1)
    .exec();

  const used = Number(replies[2]);
  return { allowed: used <= LIMIT, used, remaining: Math.max(0, LIMIT - used) };
}

async function recipe(client) {
  banner('08', 'String + Sorted Set', 'API rate limiting');
  await reset(client, 'icici:rl:*');

  step(`Fixed window - ${LIMIT} calls per ${WINDOW}s, eight calls in a burst`);
  for (let i = 1; i <= 8; i += 1) {
    const { allowed, used, remaining } = await allowFixed(client, '9003');
    say(
      `  call ${i}  ${allowed ? 'ALLOW' : 'DENY '}  used ${used}  remaining ${remaining}`
      + (allowed ? '' : '   → HTTP 429, Retry-After'),
    );
  }
  cmd('INCR icici:rl:fixed:9003:<bucket>  +  EXPIRE ... NX', 'one round trip per call');
  say('The counter key disappears on its own when the window ends. No sweeper.');

  step('The flaw every fixed window has');
  say('The window boundary is a cliff. Five calls at 09:00:59 and five more at');
  say(`09:01:00 are ten calls in one second, and both windows say "within limit".`);
  say('For a login endpoint that is the difference between throttled and not.');

  step(`Sliding window - same ${LIMIT} per ${WINDOW}s, but exact`);
  for (let i = 1; i <= 7; i += 1) {
    const { allowed, used } = await allowSliding(client, '9003');
    say(`  call ${i}  ${allowed ? 'ALLOW' : 'DENY '}  in-window ${used}`);
  }
  cmd('ZREMRANGEBYSCORE + ZADD + ZCARD in one MULTI', 'still one round trip');
  say('Every request is a member scored with its own timestamp. The window');
  say('moves continuously, so there is no boundary to exploit.');

  step('Wait for the window to roll past and try again');
  await sleep((WINDOW + 1) * 1000);
  const after = await allowSliding(client, '9003');
  say(`  after ${WINDOW + 1}s idle:  ${after.allowed ? 'ALLOW' : 'DENY'}  in-window ${after.used}`);
  say('The old members were dropped by ZREMRANGEBYSCORE on this very call -');
  say('the structure cleans itself as a side effect of being used.');

  step('Choosing between them');
  say('  fixed    8 bytes per customer per window, one INCR. Use it by default.');
  say('  sliding  ~70 bytes per request in flight. Use it on login, OTP, payments -');
  say('           anywhere the boundary burst actually matters.');

  takeaway(
    'Rate limits are shared state, so they live in Redis, not in the Node '
    + 'process. Fixed window for volume, sliding window for anything abusable.',
  );
}

main(recipe);
