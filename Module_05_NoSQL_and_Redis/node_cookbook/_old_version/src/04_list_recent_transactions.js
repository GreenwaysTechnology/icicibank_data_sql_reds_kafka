/**
 * 04 · LIST · "Your last 10 transactions"
 * ---------------------------------------------------------------------
 * Use case    The mini-statement on the app home screen. It never shows
 *             more than ten rows, and it must render instantly.
 * Structure   List, kept capped - a linked list of entries, cheap at both
 *             ends, expensive in the middle.
 * Commands    LPUSH · LTRIM · LRANGE · LLEN · LINDEX · RPOP
 * Why Redis   SELECT ... ORDER BY posted_at DESC LIMIT 10 hits the biggest
 *             table in the bank on every app open. LPUSH + LTRIM keeps a
 *             ready-made answer that is O(1) to write and O(10) to read.
 * Run         node src/04_list_recent_transactions.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const KEEP = 10;
const key = (acct) => `icici:recent:${acct}`;

/** Record a transaction and cap the list. This is the whole pattern. */
async function recordTransaction(client, acct, txn) {
  await client
    .multi()
    .lPush(key(acct), JSON.stringify(txn))
    .lTrim(key(acct), 0, KEEP - 1) // keep index 0..9, discard the rest
    .exec();
}

async function recipe(client) {
  banner('04', 'List', 'Last ten transactions per account');
  await reset(client, 'icici:recent:*');

  step('Twelve transactions post to account 9003');
  for (let i = 1; i <= 12; i += 1) {
    await recordTransaction(client, 9003, {
      id: `txn:${i}`,
      amount: -(i * 125),
      at: new Date(Date.now() - (12 - i) * 60_000).toISOString().slice(11, 19),
    });
  }
  cmd(`LPUSH ${key(9003)} {...}  +  LTRIM ${key(9003)} 0 9`, 'x12');
  cmd(`LLEN ${key(9003)}`, await client.lLen(key(9003)));
  say('Ten. The other two were dropped by LTRIM the moment they fell off the');
  say('end - there is no cleanup job and the list can never grow unbounded.');

  step('Render the mini-statement');
  const rows = await client.lRange(key(9003), 0, KEEP - 1);
  cmd(`LRANGE ${key(9003)} 0 9`, `${rows.length} entries`);
  rows.forEach((raw, i) => {
    const t = JSON.parse(raw);
    say(`  ${String(i + 1).padStart(2)}. ${t.at}  ${t.id.padEnd(8)} ${t.amount}`);
  });
  say('Newest first, because LPUSH pushes onto the head. That ordering is free.');

  step('Just the newest one, without fetching the rest');
  const newest = JSON.parse(await client.lIndex(key(9003), 0));
  cmd(`LINDEX ${key(9003)} 0`, newest.id);
  say('LINDEX is O(n) from the nearest end - on a 10-element list, irrelevant.');
  say('On a 2-million-element list, index 1,000,000 would be a real cost.');

  step('The oldest entry still held');
  cmd(`LINDEX ${key(9003)} -1`, JSON.parse(await client.lIndex(key(9003), -1)).id);
  say('Negative indexes count from the tail: -1 is the last element.');

  step('Why LTRIM and not "delete the old ones later"');
  const enc = await client.objectEncoding(key(9003));
  const mem = await client.memoryUsage(key(9003));
  cmd(`OBJECT ENCODING ${key(9003)}`, enc);
  cmd(`MEMORY USAGE ${key(9003)}`, `${mem} bytes for ten transactions`);
  say('A capped list has a known, constant cost per account. Multiply by');
  say('50 million customers and that predictability is the whole design.');

  takeaway(
    'LPUSH + LTRIM in one MULTI is the "keep the newest N" pattern: O(1) to '
    + 'write, bounded memory, newest-first for free.',
  );
}

main(recipe);
