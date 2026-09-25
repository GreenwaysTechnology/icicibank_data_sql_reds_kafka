/**
 * infra/db.js - the PostgreSQL connection pool (source of truth).
 */
import pg from 'pg';
import { config } from '../config/index.js';

// Return NUMERIC columns as JS numbers instead of strings (amounts fit easily)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number.parseFloat(v)));

export const pool = new pg.Pool(config.postgres);

export const query = (text, params) => pool.query(text, params);

/** Run fn(client) inside BEGIN/COMMIT, rolling back on any error. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
