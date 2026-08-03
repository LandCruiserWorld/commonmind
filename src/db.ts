/**
 * CockroachDB client.
 *
 * Thin wrapper over `pg` that exposes a connection pool plus a functional
 * transaction helper for the atomic-write invariant (a memory row AND its
 * embedding are committed in one transaction — the core guarantee the demo rests on).
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(connStr = process.env.COCKROACH_DB_URL): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: connStr });
  }
  return pool;
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
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}