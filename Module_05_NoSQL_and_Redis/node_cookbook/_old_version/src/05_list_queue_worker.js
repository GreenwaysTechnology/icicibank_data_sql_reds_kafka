/**
 * 05 · LIST · Reliable job queue (statement generation)
 * ---------------------------------------------------------------------
 * Use case    "Email me my statement" queues a PDF job. Several workers
 *             consume it. A worker that crashes mid-job must not lose it.
 * Structure   Two Lists - the queue and a per-worker processing list.
 * Commands    LPUSH · BLMOVE · LREM · LRANGE · LMOVE · LLEN
 * Why Redis   LPUSH/BRPOP is a queue in two commands. The reliable version
 *             adds one idea: never remove a job until it is done - move it
 *             somewhere you can find it again.
 * Watch out   BRPOP alone DELETES the job the instant the worker receives
 *             it. Crash one line later and the job is gone with no trace.
 * Run         node src/05_list_queue_worker.js
 */
import { main, banner, step, cmd, say, takeaway, reset, sleep, connect } from './_client.js';

const QUEUE = 'icici:q:statements';
const processingKey = (worker) => `${QUEUE}:processing:${worker}`;

async function enqueue(client, job) {
  return client.lPush(QUEUE, JSON.stringify(job));
}

/**
 * Take one job, atomically moving it to this worker's processing list.
 * BLMOVE blocks up to `timeout` seconds instead of polling in a loop.
 */
async function claim(client, worker, timeout = 2) {
  return client.blMove(QUEUE, processingKey(worker), 'RIGHT', 'LEFT', timeout);
}

/** Acknowledge: the job is finished, remove it from the processing list. */
async function ack(client, worker, raw) {
  return client.lRem(processingKey(worker), 1, raw);
}

async function worker(name, crashOn = null) {
  const client = await connect();
  const done = [];
  try {
    for (;;) {
      const raw = await claim(client, name);
      if (raw === null) break; // queue drained
      const job = JSON.parse(raw);

      if (job.id === crashOn) {
        say(`  ${name} picked ${job.id} and crashed before acknowledging it`);
        return { name, done, crashed: job.id };
      }

      await sleep(30); // "generate the PDF"
      await ack(client, name, raw);
      done.push(job.id);
    }
  } finally {
    await client.close();
  }
  return { name, done, crashed: null };
}

async function recipe(client) {
  banner('05', 'List', 'Reliable job queue with crash recovery');
  await reset(client, `${QUEUE}*`);

  step('Ten statement jobs are queued');
  for (let i = 1; i <= 10; i += 1) {
    await enqueue(client, { id: `stmt-${i}`, acct: 9000 + i, month: '2026-09' });
  }
  cmd(`LPUSH ${QUEUE} {...}`, await client.lLen(QUEUE));
  say('LPUSH on the head, BLMOVE from the tail - that makes it FIFO.');

  step('Two workers consume in parallel, one of them dies on stmt-4');
  const results = await Promise.all([worker('w1'), worker('w2', 'stmt-4')]);
  for (const r of results) {
    say(`  ${r.name} completed ${r.done.length}: ${r.done.join(', ') || '(none)'}`);
  }

  step('The queue is empty - but is any work lost?');
  cmd(`LLEN ${QUEUE}`, await client.lLen(QUEUE));
  const orphaned = await client.lRange(processingKey('w2'), 0, -1);
  cmd(`LRANGE ${processingKey('w2')} 0 -1`, orphaned.map((j) => JSON.parse(j).id));
  say('There it is. The crashed worker never acknowledged stmt-4, so it is');
  say('still sitting in that worker\'s processing list - visible, recoverable.');
  say('With plain BRPOP this job would simply not exist any more.');

  step('A janitor requeues anything left behind by a dead worker');
  let requeued = 0;
  for (;;) {
    const moved = await client.lMove(processingKey('w2'), QUEUE, 'RIGHT', 'LEFT');
    if (moved === null) break;
    requeued += 1;
  }
  cmd(`LMOVE ${processingKey('w2')} ${QUEUE} RIGHT LEFT`, `${requeued} job(s) requeued`);

  step('A healthy worker picks it up');
  const recovery = await worker('w3');
  say(`  w3 completed ${recovery.done.length}: ${recovery.done.join(', ')}`);
  cmd(`LLEN ${QUEUE}`, await client.lLen(QUEUE));
  cmd(`LLEN ${processingKey('w3')}`, await client.lLen(processingKey('w3')));
  say('Queue empty, nothing in flight, every job accounted for.');

  takeaway(
    'BLMOVE into a per-worker processing list, LREM to acknowledge, and a '
    + 'janitor that requeues the leftovers. For anything bigger, use Streams '
    + 'with consumer groups (recipe 12) - Redis does the bookkeeping for you.',
  );
}

main(recipe);
