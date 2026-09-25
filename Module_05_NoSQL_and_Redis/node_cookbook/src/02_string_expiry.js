/**
 * 02 - STRING + TTL - A value that deletes itself
 *
 * Idea     : Save an OTP for 5 seconds. After that Redis removes it for us.
 * Type     : String with an expiry time (TTL = Time To Live)
 * Commands : SET with EX, GET, TTL, EXPIRE, DEL, EXISTS
 * Run      : node src/02_string_expiry.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

// A small helper so we can wait a few seconds and watch the key disappear.
function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

console.log('--- An OTP that expires by itself ---');

await client.del('otp:9876543210');

// EX: 5 means "delete this key automatically after 5 seconds".
await client.set('otp:9876543210', '482913', { EX: 5 });
console.log('Saved OTP:', await client.get('otp:9876543210'));   // 482913

// TTL tells you how many seconds are left.
console.log('Seconds left:', await client.ttl('otp:9876543210')); // 5

console.log('Waiting 3 seconds...');
await wait(3);
console.log('Seconds left:', await client.ttl('otp:9876543210')); // 2
console.log('OTP is still here:', await client.get('otp:9876543210'));

console.log('Waiting 3 more seconds...');
await wait(3);

// The key is gone. Nobody deleted it - Redis did it on its own.
console.log('OTP now:', await client.get('otp:9876543210'));     // null
console.log('Does the key exist?', await client.exists('otp:9876543210')); // 0

console.log('');
console.log('--- Two more things to know ---');

// 1. A key with no expiry time returns -1.
await client.set('user:name', 'Asha');
console.log('TTL of a normal key:', await client.ttl('user:name'));   // -1

// 2. A key that does not exist returns -2.
console.log('TTL of a missing key:', await client.ttl('no:such:key')); // -2

// You can also add an expiry to a key that already exists.
await client.expire('user:name', 60);
console.log('TTL after EXPIRE:', await client.ttl('user:name'));      // 60

await client.del('user:name');

console.log('');
console.log('Where this is used: OTPs, login sessions, "remember this for a while" caches.');

await client.quit();
