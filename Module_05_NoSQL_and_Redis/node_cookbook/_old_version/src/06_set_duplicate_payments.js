/**
 * 06 · SET · Duplicate payment guard, and customer segments
 * ---------------------------------------------------------------------
 * Use case    (a) The UPI gateway retries on timeout. The same payment
 *                 request must never be posted twice.
 *             (b) Marketing wants "gold customers who use the mobile app
 *                 but have no credit card".
 * Structure   Set - unordered, unique members, O(1) membership.
 * Commands    SADD · SISMEMBER · SCARD · SMEMBERS · SINTER · SDIFF
 *             SUNION · SRANDMEMBER · SPOP · EXPIRE
 * Why Redis   SADD's return value IS the answer to "have I seen this
 *             before?" - one round trip, atomic, no SELECT-then-INSERT
 *             race. And set algebra that would be three SQL joins runs in
 *             microseconds on the server.
 * Run         node src/06_set_duplicate_payments.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const SEEN = 'icici:seen:req';
const DAY = 60 * 60 * 24;

/**
 * Idempotency in one round trip.
 * Returns true if this is the first time we have seen the request id.
 */
async function claimRequest(client, requestId) {
  const added = await client.sAdd(SEEN, requestId);
  return added === 1;
}

async function recipe(client) {
  banner('06', 'Set', 'Duplicate payment guard and customer segments');
  await reset(client, 'icici:seen:*');
  await reset(client, 'icici:seg:*');

  /* --------------------------------------------------------------- */
  step('A payment request arrives');
  const first = await claimRequest(client, 'REQ-88213');
  cmd(`SADD ${SEEN} REQ-88213`, first ? '(integer) 1' : '(integer) 0');
  say(`first time seen: ${first}  → post the payment`);

  step('The gateway times out and retries the SAME request id');
  const second = await claimRequest(client, 'REQ-88213');
  cmd(`SADD ${SEEN} REQ-88213`, second ? '(integer) 1' : '(integer) 0');
  say(`first time seen: ${second}  → reject, return the original result`);
  say('The reply itself is the decision. No SISMEMBER-then-SADD, which has a');
  say('window between the two commands where a second server can slip in.');

  step('Give the guard a lifetime so it does not grow forever');
  await client.expire(SEEN, DAY);
  cmd(`EXPIRE ${SEEN} 86400`, await client.ttl(SEEN));
  say('One shared Set expires as a whole. If you need per-request expiry,');
  say('use SET icici:seen:REQ-88213 1 NX EX 86400 instead - same idea, and');
  say('the NX reply plays exactly the role SADD\'s reply plays here.');

  /* --------------------------------------------------------------- */
  step('Segments: three sets, built once a night');
  await client.sAdd('icici:seg:gold', ['9001', '9003', '9004', '9007', '9009']);
  await client.sAdd('icici:seg:mobile', ['9003', '9004', '9005', '9009']);
  await client.sAdd('icici:seg:creditcard', ['9004', '9009', '9011']);
  cmd('SCARD icici:seg:gold', await client.sCard('icici:seg:gold'));
  cmd('SCARD icici:seg:mobile', await client.sCard('icici:seg:mobile'));
  cmd('SCARD icici:seg:creditcard', await client.sCard('icici:seg:creditcard'));

  step('Is this customer in the gold segment?');
  cmd('SISMEMBER icici:seg:gold 9003', await client.sIsMember('icici:seg:gold', '9003'));
  say('O(1) regardless of whether the set holds 5 members or 5 million.');

  step('Gold AND mobile');
  const both = await client.sInter(['icici:seg:gold', 'icici:seg:mobile']);
  cmd('SINTER icici:seg:gold icici:seg:mobile', both.sort());

  step('Gold AND mobile AND NOT credit card - the campaign list');
  await client.sInterStore('icici:seg:tmp', ['icici:seg:gold', 'icici:seg:mobile']);
  const target = await client.sDiff(['icici:seg:tmp', 'icici:seg:creditcard']);
  cmd('SINTERSTORE icici:seg:tmp gold mobile', '(integer) ' + both.length);
  cmd('SDIFF icici:seg:tmp icici:seg:creditcard', target.sort());
  say('Two commands, executed inside Redis. The equivalent in SQL is a join');
  say('plus a NOT EXISTS over three large tables, run against the OLTP box.');

  step('A random sample for an A/B test');
  cmd('SRANDMEMBER icici:seg:gold 2', await client.sRandMember('icici:seg:gold', 2));
  say('SRANDMEMBER leaves the set alone; SPOP removes what it returns - which');
  say('is how you hand out one-time vouchers without handing out any twice.');

  step('Cost');
  cmd('OBJECT ENCODING icici:seg:gold', await client.objectEncoding('icici:seg:gold'));
  say('"intset" - a set of integers only is stored as a sorted array of ints,');
  say('which is dense and cache-friendly. Add one non-numeric member and it');
  say('becomes a listpack or a hashtable, and the memory goes up sharply.');

  await client.unlink('icici:seg:tmp');
  takeaway(
    'Use SADD\'s 1/0 reply for idempotency, and SINTER/SDIFF/SUNION to do set '
    + 'algebra on the server instead of pulling both lists into Node.',
  );
}

main(recipe);
