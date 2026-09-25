/**
 * 13 - PUB/SUB - Sending a message to everyone listening
 *
 * Idea     : One program shouts on a channel. Every program listening to
 *            that channel hears it at the same time.
 * Type     : Pub/Sub (publish and subscribe) - nothing is stored
 * Commands : SUBSCRIBE, PUBLISH, UNSUBSCRIBE
 * Run      : node src/13_pubsub_notifications.js
 *
 * NOTE: a connection that is listening cannot run normal commands, so we
 *       need TWO connections - one to listen, one to send.
 */
import { createClient } from 'redis';

// Connection 1: the sender.
const sender = createClient({ socket: { reconnectStrategy: false } });
sender.on('error', (err) => console.log('Redis problem:', err.message));
await sender.connect();

// Connection 2: the listener. duplicate() copies the same settings.
const listener = sender.duplicate();
await listener.connect();

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

console.log('--- Class announcements ---');

// SUBSCRIBE: "tell me whenever something is published on this channel".
// The function runs every time a message arrives.
await listener.subscribe('announcements', (message) => {
  console.log('  [student phone] got:', message);
});

console.log('The student is now listening to the "announcements" channel.');

console.log('');
console.log('The teacher sends two messages:');

// PUBLISH returns how many listeners received the message.
const got1 = await sender.publish('announcements', 'Class starts at 10 am');
console.log('  [teacher] sent a message. Listeners reached:', got1);   // 1

const got2 = await sender.publish('announcements', 'Bring your laptop');
console.log('  [teacher] sent a message. Listeners reached:', got2);   // 1

// Give the messages a moment to arrive before we continue.
await wait(0.5);

console.log('');
console.log('--- A message with nobody listening ---');

const got3 = await sender.publish('empty-channel', 'Is anyone there?');
console.log('Listeners reached:', got3);   // 0
console.log('Nobody heard it, and Redis did NOT save it. It is simply gone.');

console.log('');
console.log('--- The student stops listening ---');

await listener.unsubscribe('announcements');
await wait(0.3);

const got4 = await sender.publish('announcements', 'Class is cancelled');
console.log('Listeners reached:', got4);   // 0
console.log('The student never sees this message.');

console.log('');
console.log('Pub/Sub vs Stream (program 12):');
console.log('  Pub/Sub : live only. If you are not listening, you miss it.');
console.log('  Stream  : saved. You can read old entries whenever you want.');

await listener.quit();
await sender.quit();
