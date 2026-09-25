/**
 * 03 - HASH - A student profile
 *
 * Idea     : Keep name, city and marks together under ONE key.
 * Type     : Hash (a key that holds field -> value pairs, like an object)
 * Commands : HSET, HGET, HGETALL, HINCRBY, HDEL, HEXISTS, HKEYS
 * Run      : node src/03_hash_profile.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- A student profile stored in a Hash ---');

await client.del('student:101');

// HSET stores several fields at once.
await client.hSet('student:101', {
  name: 'Asha',
  city: 'Pune',
  marks: '78',
});

// HGET reads ONE field. You do not have to load the whole profile.
console.log('Name :', await client.hGet('student:101', 'name'));   // Asha
console.log('City :', await client.hGet('student:101', 'city'));   // Pune

// HGETALL reads every field, and gives you a normal JavaScript object.
const profile = await client.hGetAll('student:101');
console.log('Whole profile:', profile);
// { name: 'Asha', city: 'Pune', marks: '78' }

console.log('');
console.log('--- Changing one field ---');

// HINCRBY adds a number to one field. Nothing else is touched.
await client.hIncrBy('student:101', 'marks', 5);
console.log('Marks after +5:', await client.hGet('student:101', 'marks')); // 83

// Adding a new field later is fine.
await client.hSet('student:101', 'course', 'BCA');
console.log('All field names:', await client.hKeys('student:101'));
// [ 'name', 'city', 'marks', 'course' ]

// HEXISTS checks for a field. Redis answers 1 for yes and 0 for no.
console.log('Has "city"?  ', await client.hExists('student:101', 'city'));  // 1
await client.hDel('student:101', 'city');   // HDEL removes a field
console.log('Has "city"?  ', await client.hExists('student:101', 'city'));  // 0

console.log('Final profile:', await client.hGetAll('student:101'));

console.log('');
console.log('Hash vs String:');
console.log('  String : you would save the whole profile as one JSON text,');
console.log('           and rewrite all of it just to change the marks.');
console.log('  Hash   : you change only the field you want. Much less work.');

await client.quit();
