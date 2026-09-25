/**
 * 14 - LOCK - Only one program at a time
 *
 * Idea     : Two programs want to print the same report. Only one should
 *            do it. The first one to create a key "wins" and holds a lock.
 * Type     : String created with NX (only if it does not already exist)
 * Commands : SET with NX and EX, GET, DEL, TTL
 * Run      : node src/14_lock_one_at_a_time.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

/**
 * Try to take the lock.
 * NX  = only set the key if it does NOT already exist.
 * EX  = delete it automatically after this many seconds.
 *
 * Redis returns 'OK' if we got it, or null if somebody else has it.
 */
async function takeLock(owner) {
  const result = await client.set('lock:report', owner, { NX: true, EX: 30 });
  return result === 'OK';
}

console.log('--- Two programs want to print the same report ---');

await client.del('lock:report');

// Program A asks first.
const gotA = await takeLock('program-A');
console.log('program-A asked for the lock ->', gotA);   // true

// Program B asks a moment later.
const gotB = await takeLock('program-B');
console.log('program-B asked for the lock ->', gotB);   // false

console.log('');
console.log('Who holds the lock?', await client.get('lock:report'));   // program-A
console.log('It expires in      ', await client.ttl('lock:report'), 'seconds');

console.log('');
if (gotA) {
  console.log('program-A: printing the report...');
  console.log('program-A: done.');
}
if (!gotB) {
  console.log('program-B: somebody else is printing. I will skip this run.');
}

console.log('');
console.log('--- program-A finishes and gives the lock back ---');

// Only the owner should delete the lock, so check before deleting.
const owner = await client.get('lock:report');
if (owner === 'program-A') {
  await client.del('lock:report');
  console.log('Lock released by program-A.');
}

// Now program B can get it.
const gotBNow = await takeLock('program-B');
console.log('program-B asked again ->', gotBNow);   // true
console.log('Who holds the lock?', await client.get('lock:report'));   // program-B

await client.del('lock:report');

console.log('');
console.log('Why EX matters:');
console.log('  If program-A crashes before releasing the lock, the key would');
console.log('  stay forever and nobody could ever print again. EX makes Redis');
console.log('  remove it after 30 seconds, so the system recovers by itself.');

await client.quit();
