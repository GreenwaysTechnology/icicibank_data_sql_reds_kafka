/**
 * Exercise 8 — queue.js
 * A statement queue that survives a worker crashing mid-job.
 *
 *   node exercises/ex08_queue.js
 */
import { main, banner, step, cmd, say, takeaway, reset, sleep, connect } from '../src/_client.js';

const QUEUE = 'icici:q:statements';
const processing = (worker) => `${QUEUE}:processing:${worker}`;

export const enqueue = (client, job) => client.lPush(QUEUE, JSON.stringify(job));

export const claim = (client, worker, timeout = 2) =>
  client.blMove(QUEUE, processing(worker), 'RIGHT', 'LEFT', timeout);

export const ack = (client, worker, raw) => client.lRem(processing(worker), 1, raw);

export async function requeueStale(client, worker) {
  let moved = 0;
  while (await client.lMove(processing(worker), QUEUE, 'RIGHT', 'LEFT')) moved += 1;
  return moved;
}

async function worker(name, crashOn = null) {
  const client = await connect();
  const done = [];
  try {
    for (;;) {
      const raw = await claim(client, name);
      if (raw === null) break; // timed out - the queue is drained
      const job = JSON.parse(raw);

      if (job.id === crashOn) {
        say(`  ${name} picked ${job.id} and crashed before acknowledging it`);
        return done;
      }

      await sleep(30); // generate the PDF
      await ack(client, name, raw);
      done.push(job.id);
    }
  } finally {
    await client.close();
  }
  return done;
}

async function recipe(client) {
  banner('EX08', 'List', 'A queue that does not lose work');
  await reset(client, `${QUEUE}*`);

  step('Task 1 · queue ten jobs');
  for (let i = 1; i <= 10; i += 1) {
    await enqueue(client, { id: `stmt-${i}`, acct: 9_000 + i, month: '2026-09' });
  }
  cmd(`LPUSH ${QUEUE} {...}`, await client.lLen(QUEUE));
  say('LPUSH on the head, BLMOVE from the tail - that is what makes it FIFO.');

  step('Tasks 2 and 3 · two workers, one crashes on stmt-4');
  const [w1, w2] = await Promise.all([worker('w1'), worker('w2', 'stmt-4')]);
  say(`  w1 completed ${w1.length}: ${w1.join(', ') || '(none)'}`);
  say(`  w2 completed ${w2.length}: ${w2.join(', ') || '(none)'}`);

  step('Task 4 · the queue is empty, so where is stmt-4?');
  cmd(`LLEN ${QUEUE}`, await client.lLen(QUEUE));
  const stuck = await client.lRange(processing('w2'), 0, -1);
  cmd(`LRANGE ${processing('w2')} 0 -1`, stuck.map((j) => JSON.parse(j).id));
  say('Still in the crashed worker\'s processing list - visible and recoverable.');

  step('Task 5 · the janitor puts it back, a healthy worker finishes it');
  cmd(`LMOVE ${processing('w2')} ${QUEUE} RIGHT LEFT`,
      `${await requeueStale(client, 'w2')} job(s) requeued`);
  const w3 = await worker('w3');
  say(`  w3 completed ${w3.length}: ${w3.join(', ')}`);
  cmd(`LLEN ${QUEUE}`, await client.lLen(QUEUE));
  cmd(`LLEN ${processing('w3')}`, await client.lLen(processing('w3')));
  say('Queue empty, nothing in flight, every job accounted for.');

  step('Task 6 · why BRPOP alone cannot do this');
  say('BRPOP removes the job from the list at the moment it hands it to the client.');
  say('Crash one line later and the job exists nowhere - not in the queue, not in a');
  say('processing list, not in a log. There is nothing to recover, because there is');
  say('no record it was ever taken.');

  takeaway(
    'Claim and acknowledge must be two steps with the job parked somewhere in '
    + 'between. In production let a Stream consumer group keep these books.',
  );
}

main(recipe);
