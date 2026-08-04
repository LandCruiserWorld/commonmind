/**
 * CommonMind — entry point (CLI / dev harness).
 *
 * For now this wires config + the memory repository so `npm test` and early
 * demos can exercise the atomic-write + recall path against CockroachDB.
 */

import { loadConfig } from './config.js';
import { getPool } from './db.js';
import { MemoryRepository } from './memory/repository.js';
export { loadConfig, getPool, MemoryRepository };

export function hello(): string {
  const { embedProvider } = loadConfig();
  return `commonmind ready (embeddings: ${embedProvider})`;
}