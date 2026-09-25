/**
 * routes/index.js - HTTP layer. Parse the request, call a service, shape the response.
 *
 *   GET    /api/health
 *   GET    /api/customers/:id                 profile
 *   GET    /api/customers/:id/accounts        accounts + balances      (cached)
 *   GET    /api/accounts/:no/transactions     recent transactions      (cached)
 *   GET    /api/accounts/:no/lookup           beneficiary name check
 *   POST   /api/transfers                     move money, then update cache
 *   GET    /api/cache/stats                   hit/miss counters, memory, policy
 *   GET    /api/cache/keys                    every bank:* key with TTL and size
 *   DELETE /api/cache                         delete every bank:* key (demo button)
 */
import { Router } from 'express';
import * as accountService from '../services/accountService.js';
import { transfer } from '../services/transferService.js';
import * as cache from '../cache/cacheService.js';
import { pool } from '../infra/db.js';
import { redis } from '../infra/redis.js';
import { asyncRoute } from '../middleware/errors.js';

export const router = Router();

/** Every cached read returns the same envelope, plus X-Cache / X-Response-Time headers. */
function sendCached(res, t0, result) {
  const ms = Math.round((Number(process.hrtime.bigint() - t0) / 1e6) * 10) / 10;
  res.set('X-Cache', result.source === 'cache' ? 'HIT' : 'MISS');
  res.set('X-Response-Time', `${ms}ms`);
  res.json({
    source: result.source, key: result.key, ttl: result.ttl, tookMs: ms, data: result.data,
  });
}

router.get('/health', asyncRoute(async (req, res) => {
  let db = 'up';
  try { await pool.query('SELECT 1'); } catch { db = 'down'; }
  res.json({ api: 'up', db, redis: redis.isReady ? 'up' : 'down' });
}));

router.get('/customers/:id', asyncRoute(async (req, res) => {
  res.json(await accountService.getCustomer(Number(req.params.id)));
}));

router.get('/customers/:id/accounts', asyncRoute(async (req, res) => {
  const t0 = process.hrtime.bigint();
  sendCached(res, t0, await accountService.getAccounts(Number(req.params.id)));
}));

router.get('/accounts/:no/transactions', asyncRoute(async (req, res) => {
  const t0 = process.hrtime.bigint();
  sendCached(res, t0, await accountService.getStatement(req.params.no));
}));

router.get('/accounts/:no/lookup', asyncRoute(async (req, res) => {
  res.json(await accountService.lookupAccount(req.params.no));
}));

router.post('/transfers', asyncRoute(async (req, res) => {
  res.status(201).json(await transfer(req.body ?? {}));
}));

router.get('/cache/stats', asyncRoute(async (req, res) => {
  res.json(await cache.stats());
}));

router.get('/cache/keys', asyncRoute(async (req, res) => {
  res.json(await cache.listKeys());
}));

router.delete('/cache', asyncRoute(async (req, res) => {
  res.json({ deleted: await cache.clearAll() });
}));
