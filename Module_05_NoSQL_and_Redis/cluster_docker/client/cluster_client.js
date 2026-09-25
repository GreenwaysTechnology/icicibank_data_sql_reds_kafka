// Connect to the Docker Redis Cluster from the Windows host.
//
// nodeAddressMap rewrites every address the cluster advertises (its private
// 172.30.0.x IPs, pinned in docker-compose.yml) to the port published on
// localhost. Without it the client learns the topology and then cannot reach
// any node in it - see naive.js.
import { createCluster } from 'redis';

const nodeAddressMap = {
  '172.30.0.11:6379': { host: 'localhost', port: 7101 },
  '172.30.0.12:6379': { host: 'localhost', port: 7102 },
  '172.30.0.13:6379': { host: 'localhost', port: 7103 },
  '172.30.0.14:6379': { host: 'localhost', port: 7104 },
  '172.30.0.15:6379': { host: 'localhost', port: 7105 },
  '172.30.0.16:6379': { host: 'localhost', port: 7106 },
};

// Seed with every node, not just one. connect() only needs ONE seed to answer;
// with a single seed, that node being down is enough to stop the application
// starting (RootNodesUnavailableError) even though the cluster is healthy.
const cluster = createCluster({
  rootNodes: [7101, 7102, 7103, 7104, 7105, 7106].map((port) => ({
    url: `redis://localhost:${port}`,
  })),
  nodeAddressMap,
});
cluster.on('error', (e) => console.log('cluster error:', e.message || e.code || e.name));

await cluster.connect();
console.log('connected -', cluster.masters.length, 'masters');

// Keys land on different masters - the client routes each one.
await cluster.set('icici:acct:1001', 'Asha');
await cluster.set('icici:acct:1002', 'Ravi');
console.log('icici:acct:1001 ->', await cluster.get('icici:acct:1001'));
console.log('icici:acct:1002 ->', await cluster.get('icici:acct:1002'));

// A hash tag pins one customer's keys to one slot, so a transaction works.
await cluster.set('{icici:cust:42}:name', 'Meera');
await cluster.set('{icici:cust:42}:balance', '1500');
const [balance, name] = await cluster
  .multi()
  .incrBy('{icici:cust:42}:balance', 250)
  .get('{icici:cust:42}:name')
  .exec();
console.log(`MULTI on one slot -> ${name} now has ${balance}`);

// The same transaction across two slots cannot work in a cluster.
try {
  await cluster.multi().get('icici:acct:1001').get('icici:acct:1002').exec();
} catch (e) {
  console.log('MULTI across slots ->', e.constructor.name + ':', e.message);
}

await cluster.close();
