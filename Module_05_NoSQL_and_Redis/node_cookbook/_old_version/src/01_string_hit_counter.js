/**
 * 01 · STRING · Website hit counter
 * ---------------------------------------------------------------------
 * Use case    Count page views on icicibank.com - per page, per day, and
 *             a running total across the whole site.
 * Structure   String holding a 64-bit integer.
 * Commands    INCR · INCRBY · DECR · MGET · EXPIRE · TTL · OBJECT ENCODING
 * Why Redis   INCR is executed on the server and Redis runs one command at
 *             a time, so forty web servers can count the same page with no
 *             lock, no transaction and no lost updates. The read-modify-write
 *             that a relational UPDATE needs simply does not exist here.
 * Run         node src/01_string_hit_counter.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const today = () => new Date().toISOString().slice(0, 10);

const pageKey = (page, day = today()) => `web:hits:${page}:${day}`;
const totalKey = 'web:hits:total';

/** The whole hit counter is this one function. */
async function recordHit(client, page) {
  const key = pageKey(page);

  // One round trip for both counters. Not a transaction - just batched.
  const [pageHits] = await client
    .multi()
    .incr(key)
    .incr(totalKey)
    .expire(key, 60 * 60 * 24 * 40) // keep 40 days of daily counters
    .exec();

  return pageHits;
}

async function recipe(client) {
  banner('01', 'String', 'Website hit counter');
  await reset(client, 'web:hits:*');

  step('One visitor lands on /accounts/savings');
  const first = await recordHit(client, 'accounts-savings');
  cmd(`INCR ${pageKey('accounts-savings')}`, first);
  say('A key that does not exist is treated as 0, so the first INCR returns 1.');
  say('There is no "create the counter" step, and no race to create it.');

  step('Traffic arrives - 500 concurrent hits on the same page');
  // Promise.all fires all 500 without waiting; this is what a load balancer
  // spraying requests across app servers looks like to Redis.
  await Promise.all(
    Array.from({ length: 500 }, () => recordHit(client, 'accounts-savings')),
  );
  const exact = await client.get(pageKey('accounts-savings'));
  cmd(`GET ${pageKey('accounts-savings')}`, exact);
  say('501, exactly. Not 487, not 499. Atomic means atomic.');
  say('GET + parse + SET from the application would have lost dozens of these.');

  step('A second page, and a batch import of yesterday\'s log file');
  await recordHit(client, 'cards-credit');
  const batched = await client.incrBy(pageKey('cards-credit'), 12_480);
  cmd(`INCRBY ${pageKey('cards-credit')} 12480`, batched);
  say('INCRBY adds in one step - never GET, add in JavaScript, then SET.');

  step('The dashboard reads every counter it needs in one round trip');
  const pages = ['accounts-savings', 'cards-credit', 'loans-home'];
  const values = await client.mGet(pages.map((p) => pageKey(p)));
  cmd(`MGET ${pages.map((p) => pageKey(p)).join(' ')}`, values);
  pages.forEach((p, i) => say(`  ${p.padEnd(20)} ${values[i] ?? '0 (no hits today)'}`));
  say('A missing key reads back as null - render it as zero, do not crash.');

  step('The daily keys expire on their own');
  const ttl = await client.ttl(pageKey('accounts-savings'));
  cmd(`TTL ${pageKey('accounts-savings')}`, `${ttl} seconds (~${Math.round(ttl / 86400)} days)`);
  say('No cleanup job, no cron, no DELETE ... WHERE created_at < now() - 40 days.');

  step('What the counter actually costs');
  const encoding = await client.objectEncoding(totalKey);
  const bytes = await client.memoryUsage(totalKey);
  cmd(`OBJECT ENCODING ${totalKey}`, encoding);
  cmd(`MEMORY USAGE ${totalKey}`, `${bytes} bytes`);
  say('"int" - a numeric string is stored as a number, not as text, so INCR');
  say('never has to parse anything. That is why it stays O(1) at any size.');

  takeaway(
    'Any counter that several processes touch belongs in a Redis String. '
    + 'INCR / INCRBY are atomic, need no lock, and cost a few microseconds.',
  );
}

main(recipe);
