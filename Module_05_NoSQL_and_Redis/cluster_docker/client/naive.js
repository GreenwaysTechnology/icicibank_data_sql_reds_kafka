// The version that does NOT work from the host - run it once to see why.
// The cluster tells the client "slot 0-5460 lives at 172.30.0.11:6379", and
// 172.30.0.x is Docker's private network, unreachable from Windows.
import { createCluster } from 'redis';

const cluster = createCluster({ rootNodes: [{ url: 'redis://localhost:7101' }] });
cluster.on('error', (e) => console.log('error event:', e.message));

setTimeout(() => {
  console.log('no reply after 10s - the client is stuck dialling 172.30.0.x addresses');
  process.exit(1);
}, 10_000);

await cluster.connect();
console.log('connected');       // never printed from the Windows host
