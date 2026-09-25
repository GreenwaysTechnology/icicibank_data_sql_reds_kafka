/**
 * 13 · PUB/SUB · Fraud alert fan-out and cache invalidation
 * ---------------------------------------------------------------------
 * Use case    (a) A fraud rule fires; every fraud console open in the
 *                 office must light up now.
 *             (b) One app server evicts a cache entry and needs the other
 *                 nineteen to drop their local copy too.
 * Structure   Channels. No storage at all - a message is delivered to
 *             whoever is connected at that instant, then it is gone.
 * Commands    SUBSCRIBE · PSUBSCRIBE · PUBLISH · PUBSUB CHANNELS
 * Why Redis   Fan-out to N listeners in one command, with no broker to run.
 * Watch out   Fire and forget. No persistence, no acknowledgement, no
 *             replay. A subscriber that is reconnecting misses everything
 *             sent while it was away. If that matters, use a Stream.
 * Note        A connection in subscriber mode cannot run normal commands,
 *             so the subscriber gets its own connection via duplicate().
 * Run         node src/13_pubsub_fraud_alerts.js
 */
import { main, banner, step, cmd, say, takeaway, sleep } from './_client.js';

const ALERTS = 'icici:alerts:fraud';

async function recipe(client) {
  banner('13', 'Pub/Sub', 'Fraud alerts and cache invalidation');

  step('Two fraud consoles subscribe');
  const console1 = client.duplicate();
  const console2 = client.duplicate();
  await console1.connect();
  await console2.connect();

  const received = { c1: [], c2: [], pattern: [] };

  await console1.subscribe(ALERTS, (message) => {
    received.c1.push(message);
    say(`  console-1 ← ${message}`);
  });
  await console2.subscribe(ALERTS, (message) => {
    received.c2.push(message);
    say(`  console-2 ← ${message}`);
  });
  cmd(`SUBSCRIBE ${ALERTS}`, '2 subscribers');

  step('A supervisor watches every alert channel with one pattern');
  const supervisor = client.duplicate();
  await supervisor.connect();
  await supervisor.pSubscribe('icici:alerts:*', (message, channel) => {
    received.pattern.push(message);
    say(`  supervisor ← [${channel}] ${message}`);
  });
  cmd('PSUBSCRIBE icici:alerts:*', 'OK');

  step('A rule fires');
  const delivered = await client.publish(
    ALERTS,
    JSON.stringify({ acct: 9003, rule: 'CARD_NOT_PRESENT_VELOCITY', score: 0.94 }),
  );
  cmd(`PUBLISH ${ALERTS} {...}`, `${delivered} clients received it`);
  await sleep(100);
  say('One PUBLISH, three deliveries. Adding a fourth console costs nothing.');

  step('A different channel - only the pattern subscriber sees it');
  await client.publish('icici:alerts:aml', JSON.stringify({ acct: 9011, rule: 'STRUCTURING' }));
  await sleep(100);

  step('Who is listening right now?');
  const channels = await client.pubSubChannels('icici:alerts:*');
  cmd('PUBSUB CHANNELS icici:alerts:*', channels);
  cmd(`PUBSUB NUMSUB ${ALERTS}`, JSON.stringify(await client.pubSubNumSub(ALERTS)));

  step('Now the part people get wrong');
  await console2.unsubscribe(ALERTS);
  await sleep(50);
  const afterUnsub = await client.publish(ALERTS, JSON.stringify({ acct: 9099, rule: 'MULE' }));
  await sleep(100);
  cmd(`PUBLISH ${ALERTS} {...}`, `${afterUnsub} clients received it`);
  say('console-2 had disconnected, so that alert never reached it and never');
  say('will. There is no backlog to catch up on - the message is simply gone.');
  say(`console-1 total: ${received.c1.length}   console-2 total: ${received.c2.length}`);

  step('The rule of thumb');
  say('  Pub/Sub  a live console, a chat room, "invalidate your local cache" -');
  say('           anything where missing a message during a restart is harmless.');
  say('  Stream   a payment event, an audit record, a job - anything where it');
  say('           is not. See recipe 12.');

  await Promise.all([console1.close(), console2.close(), supervisor.close()]);

  takeaway(
    'PUBLISH returns the number of clients that got it. If that number '
    + 'being 0 would be a problem, you needed a Stream, not a channel.',
  );
}

main(recipe);
