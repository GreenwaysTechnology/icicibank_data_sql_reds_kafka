/**
 * server.js - wires the layers together and starts listening.
 *
 *   HTTP (routes) -> services -> repositories -> PostgreSQL
 *                         \--> cacheService  -> Redis
 */
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { router } from './routes/index.js';
import { connectRedis, redis } from './infra/redis.js';
import { pool } from './infra/db.js';
import { errorHandler, requestLog } from './middleware/errors.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLog);
app.use('/api', router);
app.use((req, res) => res.status(404).json({ error: `No route ${req.method} ${req.path}` }));
app.use(errorHandler);

// Not awaited on purpose: the API starts even if Redis is down and connects when it can.
connectRedis();

const server = app.listen(config.port, () => {
  console.log(`[api] listening on :${config.port}  cache=${config.cache.enabled ? 'on' : 'off'}`
    + `  ttl=${config.cache.ttlSeconds}s  onWrite=${config.cache.onWrite}`);
});

async function shutdown() {
  server.close();
  await Promise.allSettled([pool.end(), redis.isOpen ? redis.quit() : null]);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
