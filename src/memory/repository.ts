/**
 * Memory repository (CockroachDB).
 *
 * Implements the capture path: store a memory row AND its embedding in one
 * transaction, plus semantic recall against the HNSW vector index.
 */

import { getPool, withTransaction } from '../db.js';
import { MemoryRecord } from './types.js';

export class MemoryRepository {
  /**
   * Atomic write: `memory_records` + `memory_embeddings` commit together.
   */
  async remember(content: string, entityType: MemoryRecord['entityType'], embedding: number[]): Promise<string> {
    return withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO memory_records (entity_type, content)
         VALUES ($1, $2)
         RETURNING id`,
        [entityType, content],
      );
      const id = res.rows[0].id as string;
      await client.query(
        `INSERT INTO memory_embeddings (entity_type, entity_id, embedding)
         VALUES ($1, $2, $3::vector)`,
        [entityType, id, JSON.stringify(embedding)],
      );
      return id;
    });
  }

  /** Semantic recall against the HNSW vector index. */
  async recall(queryEmbedding: number[], limit = 8): Promise<Array<{ id: string; content: string; score: number }>> {
    const res = await getPool().query(
      `SELECT
         r.id, r.content,
1 - (m.embedding <=> $1::vector) AS score
       FROM memory_embeddings m
       JOIN memory_records r ON r.id = m.entity_id
       ORDER BY m.embedding <=> $1::vector
       LIMIT $2`,
      [JSON.stringify(queryEmbedding), limit],
    );
    return res.rows as Array<{ id: string; content: string; score: number }>;
  }
}