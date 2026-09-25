/**
 * EXERCISE 3 - A library book
 *
 * Learn from : src/03_hash_profile.js
 * Run        : node exercises/ex3_library_book.js
 *
 * YOUR TASK
 *   1. Store book:55 with three fields:
 *        title = 'Let Us C', author = 'Kanetkar', copies = '4'
 *   2. Print just the title.
 *   3. A student borrows a copy - reduce "copies" by 1.
 *   4. Add a field "shelf" with the value 'A3'.
 *   5. Print the whole book.
 *
 * EXPECTED OUTPUT
 *   Title: Let Us C
 *   Copies after borrowing: 3
 *   Whole book: { title: 'Let Us C', author: 'Kanetkar', copies: '3', shelf: 'A3' }
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

await client.del('book:55');

// TODO 1: store the three fields in one HSET
//         hint: client.hSet('book:55', { title: ..., author: ..., copies: ... })


// TODO 2: print only the title (use HGET)
// console.log('Title:', ...);


// TODO 3: reduce copies by 1 (use HINCRBY with -1) and print the new value
// console.log('Copies after borrowing:', ...);


// TODO 4: add the field shelf = 'A3'


// TODO 5: print every field (use HGETALL)
// console.log('Whole book:', ...);


await client.quit();
