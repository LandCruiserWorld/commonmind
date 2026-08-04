/**
 * CockroachDB client.
 *
 * Thin wrapper over `pg` that exposes a connection pool plus a functional
 * transaction helper for the atomic-write invariant (a memory row AND its
 * embedding are committed in one transaction — the core guarantee the demo rests on).
 */

import { Pool } from 'pg';
import { loadConfig } from './config.js';

let pool: Pool | null = null;

/**
 * Connection pool, built from `loadConfig()` so the configured fallback DSN
 * actually applies.
 *
 * Reading `process.env.COCKROACH_DB_URL` directly here would make that fallback
 * dead code: with the variable unset, `pg` silently falls back to libpq
 * defaults and dials **localhost:5432** — Postgres' port, not CockroachDB's
 * 26257 — producing a connection error that points at the wrong problem.
 */
export function getPool(connStr = loadConfig().dbUrl): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: connStr });
  }
  return pool;
}

/** Close and clear the pool. Tests and CLI teardown need this. */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Run `fn` inside a single transaction and commit (rollback on error). */
export async function withTransaction<T>(
  fn: (client: Pick<Pool, 'query'>) => Promise<T>,
  conn = getPool(),
): Promise<T> {
  const client = await conn.connect();
  try {
    await client.query('BEGIN');
    const result = await fn({ query: client.query.bind(client) });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Roll back best-effort: a failing ROLLBACK must not mask the real error.
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection already broken — the original error is the useful one */
    }
    throw err;
  } finally {
    client.release();
  }
}