/**
 * 12 · STREAM · Transaction event log with consumer groups
 * ---------------------------------------------------------------------
 * Use case    Every card transaction is published once and consumed by
 *             three independent teams: fraud scoring, the ledger feed, and
 *             the notification service. Nobody may miss an event.
 * Structure   Stream - an append-only log with consumer groups, per-consumer
 *             acknowledgement, and replay from any point.
 * Commands    XADD · XLEN · XRANGE · XGROUP CREATE · XREADGROUP · XACK
 *             XPENDING · XAUTOCLAIM
 * Why Redis   This is what Pub/Sub cannot do. Pub/Sub drops a message if
 *             nobody is listening; a Stream keeps it, tracks who has read
 *             it, and lets another consumer take over the work of one that
 *             died. It is Kafka's model, in Redis, for Module 08.
 * Run         node src/12_stream_txn_events.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const STREAM = 'icici:events:txn';
const GROUP = 'fraud-scoring';

async function recipe(client) {
  banner('12', 'Stream', 'Transaction events with consumer groups');
  await reset(client, 'icici:events:*');

  step('Six card transactions are appended to the log');
  const ids = [];
  for (let i = 1; i <= 6; i += 1) {
    const id = await client.xAdd(
      STREAM,
      '*', // let Redis assign <millisecondsTime>-<sequence>
      {
        txn: `txn:${1000 + i}`,
        acct: String(9000 + (i % 3)),
        amount: String(i * 1_500),
        mcc: i % 4 === 0 ? '7995' : '5411', // 7995 = gambling, interesting to fraud
      },
      { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 100_000 } },
    );
    ids.push(id);
  }
  cmd(`XADD ${STREAM} * txn ... amount ...`, ids[0]);
  cmd(`XLEN ${STREAM}`, await client.xLen(STREAM));
  say('The id is <ms>-<seq>, so entries are ordered and time-addressable.');
  say('MAXLEN ~ 100000 caps the log approximately - the "~" lets Redis trim on');
  say('node boundaries, which is far cheaper than an exact trim.');

  step('Read the raw log - any consumer, any time, no group needed');
  const range = await client.xRange(STREAM, '-', '+', { COUNT: 2 });
  cmd(`XRANGE ${STREAM} - + COUNT 2`, '');
  range.forEach((e) => say(`  ${e.id}  ${JSON.stringify(e.message)}`));
  say('Unlike a List, reading does not consume. Three teams can each read all');
  say('six events without co-ordinating with one another.');

  step('Create the fraud-scoring consumer group, starting from the beginning');
  try {
    await client.xGroupCreate(STREAM, GROUP, '0', { MKSTREAM: true });
    cmd(`XGROUP CREATE ${STREAM} ${GROUP} 0 MKSTREAM`, 'OK');
  } catch (err) {
    if (!err.message.includes('BUSYGROUP')) throw err;
    cmd(`XGROUP CREATE ${STREAM} ${GROUP} 0`, 'BUSYGROUP - already exists, fine');
  }

  step('Two workers in the group share the six events');
  for (const consumer of ['scorer-1', 'scorer-2']) {
    const reply = await client.xReadGroup(
      GROUP,
      consumer,
      [{ key: STREAM, id: '>' }], // '>' = entries never delivered to this group
      { COUNT: 3 },
    );
    const got = reply?.[0]?.messages ?? [];
    say(`  ${consumer} received ${got.length}: ${got.map((m) => m.message.txn).join(', ')}`);

    // scorer-1 does its work and acknowledges; scorer-2 "dies" before ACK.
    if (consumer === 'scorer-1') {
      for (const m of got) await client.xAck(STREAM, GROUP, m.id);
      say(`  ${consumer} acknowledged all ${got.length}`);
    } else {
      say(`  ${consumer} crashed before acknowledging anything`);
    }
  }

  step('What is still unacknowledged?');
  const pending = await client.xPending(STREAM, GROUP);
  cmd(`XPENDING ${STREAM} ${GROUP}`, JSON.stringify(pending));
  say('Redis is keeping the books: it knows exactly which entries were');
  say('delivered, to whom, and which were never confirmed done.');

  step('A healthy worker claims the dead one\'s backlog');
  const claimed = await client.xAutoClaim(STREAM, GROUP, 'scorer-3', 0, '0');
  cmd(`XAUTOCLAIM ${STREAM} ${GROUP} scorer-3 0 0`, '');
  say(`  scorer-3 claimed ${claimed.messages.length}: ${claimed.messages.map((m) => m.message.txn).join(', ')}`);
  for (const m of claimed.messages) await client.xAck(STREAM, GROUP, m.id);
  const after = await client.xPending(STREAM, GROUP);
  cmd(`XPENDING ${STREAM} ${GROUP}`, `${after.pending} pending`);
  say('Nothing was lost and nothing was processed twice. That is the entire');
  say('argument for Streams over Lists and over Pub/Sub.');

  takeaway(
    'Streams = durable log + consumer groups + acknowledgement + claim. Use '
    + 'them when losing an event matters; use Pub/Sub when it does not.',
  );
}

main(recipe);
