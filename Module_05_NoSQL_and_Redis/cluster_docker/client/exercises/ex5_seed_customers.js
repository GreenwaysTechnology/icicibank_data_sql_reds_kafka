// Exercise 5 - seed 1000 customers so each customer's keys share a slot,
// then report how the cluster spread them across the masters.
import { connect } from './connect.js';

const cluster = await connect();
const N = 1000;

for (let id = 1; id <= N; id++) {
  const tag = `{icici:cust:${id}}`;
  // Both keys carry the same hash tag, so one MULTI can write them together.
  await cluster
    .multi()
    .hSet(`${tag}:profile`, { name: `Customer ${id}`, branch: `BR-${100 + (id % 7)}` })
    .set(`${tag}:bal`, String(1000 + id))
    .exec();
}
console.log(`seeded ${N} customers, 2 keys each`);

// Ask every master directly. SCAN on the cluster object would only ever
// see ONE node; the answer has to be summed across masters.
let total = 0;
for (const master of cluster.masters) {
  const client = await cluster.nodeClient(master);
  let count = 0;
  for await (const keys of client.scanIterator({ MATCH: '{icici:cust:*', COUNT: 500 })) {
    count += keys.length;
  }
  total += count;
  console.log(`${master.address.padEnd(18)} ${String(count).padStart(5)} customer keys`);
}
console.log(`total             ${String(total).padStart(5)}  (expected ${2 * N})`);

// Prove one customer's keys really are co-located.
const [p, b] = await Promise.all([
  cluster.hGet('{icici:cust:42}:profile', 'name'),
  cluster.get('{icici:cust:42}:bal'),
]);
console.log(`customer 42 -> ${p}, balance ${b}`);

await cluster.close();
