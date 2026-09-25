/**
 * 10 - BITMAP - Class attendance
 *
 * Idea     : One student, 30 days. Store present/absent as single bits:
 *            bit 1 = present, bit 0 = absent. 30 days costs 4 bytes.
 * Type     : Bitmap (a String, but you read and write single bits)
 * Commands : SETBIT, GETBIT, BITCOUNT, STRLEN
 * Run      : node src/10_bitmap_attendance.js
 */
import { createClient } from 'redis';

const client = createClient({ socket: { reconnectStrategy: false } });
client.on('error', (err) => console.log('Redis problem:', err.message));
await client.connect();

console.log('--- Attendance for student 101 in June ---');

await client.del('attendance:101:june');

// SETBIT key position value
// Position = the day of the month. Value = 1 for present, 0 for absent.
await client.setBit('attendance:101:june', 1, 1);   // present on 1 June
await client.setBit('attendance:101:june', 2, 1);   // present on 2 June
await client.setBit('attendance:101:june', 3, 0);   // absent  on 3 June
await client.setBit('attendance:101:june', 4, 1);   // present on 4 June
await client.setBit('attendance:101:june', 5, 1);   // present on 5 June

console.log('');
console.log('--- Was the student present on a given day? ---');

// GETBIT reads one bit back.
console.log('1 June ->', await client.getBit('attendance:101:june', 1));  // 1
console.log('3 June ->', await client.getBit('attendance:101:june', 3));  // 0

// A day we never wrote is 0, which reads as "absent".
console.log('9 June ->', await client.getBit('attendance:101:june', 9));  // 0

console.log('');
console.log('--- How many days present? ---');

// BITCOUNT counts all the 1 bits. That is the attendance total.
console.log('Days present:', await client.bitCount('attendance:101:june'));   // 4

console.log('');
console.log('--- Mark the rest of the week ---');

await client.setBit('attendance:101:june', 6, 1);
await client.setBit('attendance:101:june', 7, 1);

console.log('Days present:', await client.bitCount('attendance:101:june'));   // 6

console.log('');
console.log('--- How much memory is this using? ---');

// STRLEN gives the size in BYTES. 1 byte holds 8 days.
const bytes = await client.strLen('attendance:101:june');
console.log('Bytes used:', bytes);   // 1

await client.setBit('attendance:101:june', 30, 1);
console.log('After marking day 30, bytes used:', await client.strLen('attendance:101:june')); // 4

console.log('');
console.log('4 bytes for a whole month of attendance for one student.');
console.log('1000 students for a whole year is still only a few hundred KB.');

await client.quit();
