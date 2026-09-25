// Shared by the exercise solutions: the same connection cluster_client.js uses
// - every node as a seed, and the Docker-internal addresses mapped to the
// ports published on localhost.
import { createCluster } from 'redis';

const PORTS = [7101, 7102, 7103, 7104, 7105, 7106];

export async function connect() {
  const nodeAddressMap = Object.fromEntries(
    PORTS.map((port, i) => [`172.30.0.${11 + i}:6379`, { host: 'localhost', port }]),
  );
  const cluster = createCluster({
    rootNodes: PORTS.map((port) => ({ url: `redis://localhost:${port}` })),
    nodeAddressMap,
  });
  cluster.on('error', (e) => console.log('cluster error:', e.message || e.code || e.name));
  await cluster.connect();
  return cluster;
}
