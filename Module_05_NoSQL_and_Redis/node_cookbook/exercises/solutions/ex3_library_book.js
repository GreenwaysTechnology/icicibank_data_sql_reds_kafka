/**
 * SOLUTION 3 - A library book
 * Run: node exercises/solutions/ex3_library_book.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

await client.del('book:55');

// TODO 1: one HSET can store many fields at once.
await client.hSet('book:55', {
  title: 'Let Us C',
  author: 'Kanetkar',
  copies: '4',
});

// TODO 2: HGET reads one field. You do not load the whole book.
console.log('Title:', await client.hGet('book:55', 'title'));   // Let Us C

// TODO 3: HINCRBY with a negative number subtracts.
// It returns the new value, so there is no need to read it back.
const left = await client.hIncrBy('book:55', 'copies', -1);
console.log('Copies after borrowing:', left);                   // 3

// TODO 4: adding a field later is fine - a Hash has no fixed shape.
await client.hSet('book:55', 'shelf', 'A3');

// TODO 5: HGETALL gives you a normal JavaScript object.
console.log('Whole book:', await client.hGetAll('book:55'));
// { title: 'Let Us C', author: 'Kanetkar', copies: '3', shelf: 'A3' }

await client.quit();
