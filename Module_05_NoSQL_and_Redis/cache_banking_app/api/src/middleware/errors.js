/**
 * middleware/errors.js - one error type, one handler, consistent JSON errors.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Wrap an async route so a rejected promise reaches errorHandler. */
export const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status ?? 500;
  if (status >= 500) console.error('[api] error:', err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
}

/** Logs every request with how long it took - handy next to the [cache] lines. */
export function requestLog(req, res, next) {
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`[api] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}
