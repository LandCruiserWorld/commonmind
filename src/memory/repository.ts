/**
 * Memory repository (CockroachDB).
 *
 * Implements the capture path: store a memory row AND its embedding in one
 * transaction, plus semantic recall against the C-SPANN vector index.
 */

import { getPool, withTransaction } from '../db.js';
import { MemoryRecord } from './types.js';

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface ApprovalRecord {
  id: string;
  body: string;
  correlationId: string;
  status: ApprovalStatus;
  expiresAt: Date;
}

const CLI_SERVICE_TOKEN = 'commonmind-cli';

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
      await writeMemoryEvent(client, entityType, id, 'created', { content });
      return id;
    });
  }

  /** Semantic recall against the C-SPANN vector index. */
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

  /** Create an approval once, or return its durable state after a restart. */
  async openApproval(body: string, correlationId: string, expiresAt: Date): Promise<ApprovalRecord> {
    return withTransaction(async (client) => {
      const serviceId = await ensureCliService(client);
      const inserted = await client.query(
        `INSERT INTO notifications (
           service_id, body, idempotency_key, response_type, response_status,
           correlation_id, expires_at
         )
         VALUES ($1, $2, $3, 'approval', 'pending', $3, $4)
         ON CONFLICT (service_id, idempotency_key) DO NOTHING
         RETURNING id, body, correlation_id, response_status, expires_at`,
        [serviceId, body, correlationId, expiresAt],
      );

      if (inserted.rowCount) return toApprovalRecord(inserted.rows[0]);

      const existing = await client.query(
        `SELECT id, body, correlation_id, response_status, expires_at
         FROM notifications
         WHERE service_id = $1 AND idempotency_key = $2`,
        [serviceId, correlationId],
      );
      const approval = existing.rows[0];
      if (!approval || approval.correlation_id !== correlationId || approval.body !== body) {
        throw new Error(`Correlation ID is already in use: ${correlationId}`);
      }
      return toApprovalRecord(approval);
    });
  }

  /** Expire a pending approval when its persisted deadline has elapsed. */
  async expirePendingApproval(correlationId: string): Promise<ApprovalRecord | null> {
    return withTransaction(async (client) => {
      const serviceId = await ensureCliService(client);
      await client.query(
        `UPDATE notifications
         SET response_status = 'expired', status = 'expired'
         WHERE service_id = $1
           AND correlation_id = $2
           AND response_status = 'pending'
           AND expires_at <= now()`,
        [serviceId, correlationId],
      );
      const result = await client.query(
        `SELECT id, body, correlation_id, response_status, expires_at
         FROM notifications
         WHERE service_id = $1 AND correlation_id = $2`,
        [serviceId, correlationId],
      );
      return result.rowCount ? toApprovalRecord(result.rows[0]) : null;
    });
  }

  /** Read the current durable approval state. */
  async readApproval(correlationId: string): Promise<ApprovalRecord | null> {
    return this.expirePendingApproval(correlationId);
  }

  /** Resolve a live approval and commit the human decision as embedded memory. */
  async decideApproval(
    correlationId: string,
    decision: Extract<ApprovalStatus, 'approved' | 'denied'>,
    embedding: number[],
  ): Promise<ApprovalRecord> {
    return withTransaction(async (client) => {
      const serviceId = await ensureCliService(client);
      await client.query(
        `UPDATE notifications
         SET response_status = 'expired', status = 'expired'
         WHERE service_id = $1
           AND correlation_id = $2
           AND response_status = 'pending'
           AND expires_at <= now()`,
        [serviceId, correlationId],
      );
      const resolved = await client.query(
        `UPDATE notifications
         SET response_status = $3, response_action = $3
         WHERE service_id = $1
           AND correlation_id = $2
           AND response_status = 'pending'
           AND expires_at > now()
         RETURNING id, body, correlation_id, response_status, expires_at`,
        [serviceId, correlationId, decision],
      );

      if (!resolved.rowCount) {
        const current = await client.query(
          `SELECT id, body, correlation_id, response_status, expires_at
           FROM notifications
           WHERE service_id = $1 AND correlation_id = $2`,
          [serviceId, correlationId],
        );
        if (!current.rowCount) throw new Error(`Unknown approval: ${correlationId}`);
        return toApprovalRecord(current.rows[0]);
      }

      const approval = toApprovalRecord(resolved.rows[0]);
      const memory = await client.query(
        `INSERT INTO memory_records (entity_type, content)
         VALUES ('decision', $1)
         RETURNING id`,
        [`Approval ${approval.correlationId} was ${approval.status}: ${approval.body}`],
      );
      await client.query(
        `INSERT INTO memory_embeddings (entity_type, entity_id, embedding)
         VALUES ('decision', $1, $2::vector)`,
        [memory.rows[0].id, JSON.stringify(embedding)],
      );
      await writeMemoryEvent(client, 'notification', approval.id, decision, {
        correlationId: approval.correlationId,
        body: approval.body,
        decisionMemoryId: memory.rows[0].id,
      });
      return approval;
    });
  }
}

/**
 * The event log is written in the same transaction as its source mutation.
 * CDC may therefore publish only committed memory state; it can never observe
 * an event whose memory row or approval decision was rolled back.
 */
async function writeMemoryEvent(
  client: Pick<ReturnType<typeof getPool>, 'query'>,
  entityType: MemoryRecord['entityType'],
  entityId: string,
  action: 'created' | 'approved' | 'denied',
  payload: Record<string, string>,
): Promise<void> {
  await client.query(
    `INSERT INTO memory_events (entity_type, entity_id, action, payload, agent)
     VALUES ($1, $2, $3, $4::jsonb, 'commonmind')`,
    [entityType, entityId, action, JSON.stringify(payload)],
  );
}

async function ensureCliService(client: Pick<ReturnType<typeof getPool>, 'query'>): Promise<string> {
  const result = await client.query(
    `INSERT INTO services (title, webhook_token, owner_id)
     VALUES ('CommonMind CLI', $1, 'local')
     ON CONFLICT (webhook_token) DO UPDATE SET webhook_token = EXCLUDED.webhook_token
     RETURNING id`,
    [CLI_SERVICE_TOKEN],
  );
  return result.rows[0].id as string;
}

function toApprovalRecord(row: Record<string, unknown>): ApprovalRecord {
  const status = row.response_status;
  if (status !== 'pending' && status !== 'approved' && status !== 'denied' && status !== 'expired') {
    throw new Error(`Invalid approval status: ${String(status)}`);
  }
  return {
    id: String(row.id),
    body: String(row.body),
    correlationId: String(row.correlation_id),
    status,
    expiresAt: new Date(String(row.expires_at)),
  };
}
