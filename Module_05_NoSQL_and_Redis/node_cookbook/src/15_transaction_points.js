/**
 * 15 - TRANSACTION - Moving points from one player to another
 *
 * Idea     : Take 50 points from Asha and give them to Ravi. Both changes
 *            must happen together, with nothing else squeezing in between.
 * Type     : MULTI / EXEC (a group of commands run one after another)
 * Commands : MULTI, EXEC, WATCH
 * Run      : node src/15_transaction_points.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Moving points between two players ---');

await client.set('points:asha', '100');
await client.set('points:ravi', '20');

console.log('Before:  asha =', await client.get('points:asha'),
            ' ravi =', await client.get('points:ravi'));

// MULTI collects commands. Nothing runs yet.
// EXEC sends them all together, and Redis runs them one after another
// without letting any other command cut in.
await client
  .multi()
  .decrBy('points:asha', 50)
  .incrBy('points:ravi', 50)
  .exec();

console.log('After :  asha =', await client.get('points:asha'),
            ' ravi =', await client.get('points:ravi'));
// asha = 50   ravi = 70

console.log('');
console.log('--- What a Redis transaction does NOT do ---');
console.log('It does not undo anything. If one command fails, the others still');
console.log('happened. So a check like "does she have enough points?" cannot be');
console.log('done by reading first and hoping. That is what WATCH is for.');

console.log('');
console.log('--- WATCH: stop if somebody changed the value ---');

await client.set('points:asha', '50');

// WATCH means: "keep an eye on this key. If it changes before my EXEC,
// cancel the whole transaction."
await client.watch('points:asha');

const balance = Number(await client.get('points:asha'));
console.log('Asha has', balance, 'points. She wants to send 30.');

if (balance >= 30) {
  const result = await client
    .multi()
    .decrBy('points:asha', 30)
    .incrBy('points:ravi', 30)
    .exec();

  // exec() returns null if the watched key was changed by somebody else.
  if (result === null) {
    console.log('Cancelled - somebody changed her points while we were deciding.');
  } else {
    console.log('Transfer done.');
  }
} else {
  await client.unwatch();
  console.log('Not enough points. Nothing was changed.');
}

console.log('After :  asha =', await client.get('points:asha'),
            ' ravi =', await client.get('points:ravi'));
// asha = 20   ravi = 100

console.log('');
console.log('--- Trying to send more than she has ---');

await client.watch('points:asha');
const balance2 = Number(await client.get('points:asha'));
console.log('Asha has', balance2, 'points. She wants to send 500.');

if (balance2 >= 500) {
  await client.multi().decrBy('points:asha', 500).incrBy('points:ravi', 500).exec();
  console.log('Transfer done.');
} else {
  // Always UNWATCH if you decide not to go ahead.
  await client.unwatch();
  console.log('Not enough points. Nothing was changed.');
}

console.log('Final :  asha =', await client.get('points:asha'),
            ' ravi =', await client.get('points:ravi'));

await client.del('points:asha');
await client.del('points:ravi');

await client.quit();
