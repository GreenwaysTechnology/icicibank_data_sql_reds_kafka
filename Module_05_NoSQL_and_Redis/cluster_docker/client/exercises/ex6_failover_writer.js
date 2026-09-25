// Exercise 6 - keep writing through a master failure and measure the gap.
//
// Increments a counter every 200 ms for 30 s. {icici:cust:42} hashes to slot
// 2022, owned by node1 in cluster_docker/, so stopping icici-rc-node1 while
// this runs takes its master away mid-stream.
import { connect } from './connect.js';

const KEY = '{icici:cust:42}:heartbeat';
const RUN_MS = 30_000;
const EVERY_MS = 200;

const cluster = await connect();
await cluster.del(KEY);

const t0 = Date.now();
const since = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5) + 's';
let ok = 0, failed = 0, down = false, downAt = 0, outage = 0;

while (Date.now() - t0 < RUN_MS) {
  try {
    await cluster.incr(KEY);
    ok++;
    if (down) {
      outage += Date.now() - downAt;
      console.log(`${since()}  recovered after ${((Date.now() - downAt) / 1000).toFixed(1)} s`);
      down = false;
    }
  } catch (e) {
    failed++;
    if (!down) {
      console.log(`${since()}  write failed: ${e.message || e.code || e.name}`);
      down = true;
      downAt = Date.now();
    }
  }
  await new Promise((r) => setTimeout(r, EVERY_MS));
}

const stored = Number(await cluster.get(KEY));
console.log('---');
console.log(`writes ok      ${ok}`);
console.log(`writes failed  ${failed}`);
console.log(`outage         ${(outage / 1000).toFixed(1)} s${down ? '  (still down at the end)' : ''}`);
console.log(`counter value  ${stored}   (${stored === ok ? 'matches' : 'DIFFERS from'} successful writes)`);
await cluster.close();
