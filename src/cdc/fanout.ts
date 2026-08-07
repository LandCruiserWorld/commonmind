/**
 * Fanout worker — the SQS consumer at the end of the push pipeline.
 *
 * Marks the `notifications` row named by a `memory_events` payload as
 * delivered. This is the only thing delivery is allowed to touch: it never
 * writes `memory_records`, `memory_embeddings`, or `memory_events` — those
 * are already committed durable memory before this worker ever runs. If this
 * worker (or the whole fanout Lambda) is deleted, memory stays correct;
 * only the push notification never marks delivered.
 */

import { getPool } from '../db.js';

/** The one shape `deliverMemoryEvent` needs — narrower than `pg`'s overloaded `Pool.query`. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
}

export interface MemoryEventPayload {
  entity_type?: string;
  entity_id?: string;
  action?: string;
}

export interface SqsRecord {
  messageId?: string;
  body: string;
}

export interface SqsEvent {
  Records: SqsRecord[];
}

/**
 * Mark the notification a memory event refers to as delivered.
 * Returns false (no-op, not an error) for events that aren't tied to a
 * `notifications` row — most memory events never crossed the alert threshold.
 */
export async function deliverMemoryEvent(
  payload: MemoryEventPayload,
  pool: Queryable = getPool(),
): Promise<boolean> {
  if (payload.entity_type !== 'notification' || !payload.entity_id) return false;
  const result = await pool.query(
    `UPDATE notifications
     SET status = 'delivered', delivered_count = delivered_count + 1
     WHERE id = $1`,
    [payload.entity_id],
  );
  return (result.rowCount ?? 0) > 0;
}

/** AWS Lambda SQS event source handler. A thrown error retries the message, then DLQs it. */
export async function handler(event: SqsEvent): Promise<void> {
  for (const record of event.Records) {
    const payload = JSON.parse(record.body) as MemoryEventPayload;
    await deliverMemoryEvent(payload);
  }
}
