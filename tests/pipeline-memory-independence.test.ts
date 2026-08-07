import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { closePool, getPool } from '../src/db.js';
import { createEmbeddingProvider } from '../src/embed.js';
import { deliverMemoryEvent } from '../src/cdc/fanout.js';
import { MemoryRepository } from '../src/memory/repository.js';

const runIntegration = process.env.RUN_PIPELINE_INTEGRATION_TESTS === '1';

test('memory is correct with the fanout worker never invoked (delete-the-Lambda gate)', { skip: !runIntegration }, async () => {
  process.env.EMBED_PROVIDER = 'local';
  const memories = new MemoryRepository();

  try {
    // Capture and decide an approval exactly as Wed/Thu did — no fanout call anywhere here.
    const correlationId = `pipeline-test-${randomUUID()}`;
    const body = `deploy ${randomUUID()}`;
    const opened = await memories.openApproval(body, correlationId, new Date(Date.now() + 60_000));
    const decisionText = `Approval ${correlationId} was approved: ${body}`;
    const embedding = await createEmbeddingProvider().embed(decisionText);
    const decided = await memories.decideApproval(correlationId, 'approved', embedding);

    // Durable memory is already fully correct — the fanout worker has never run.
    const memoryRow = await getPool().query(
      `SELECT r.id, r.content FROM memory_records r
       JOIN memory_embeddings e ON e.entity_id = r.id
       WHERE r.content = $1`,
      [decisionText],
    );
    assert.equal(memoryRow.rowCount, 1, 'decision memory + embedding committed without any delivery step');

    const eventRow = await getPool().query(
      `SELECT action FROM memory_events WHERE entity_id = $1`,
      [decided.id],
    );
    assert.equal(eventRow.rowCount, 1);
    assert.equal(eventRow.rows[0].action, 'approved');

    const recalled = await memories.recall(embedding);
    assert.ok(recalled.some((memory) => memory.content === decisionText), 'recall works with no fanout involved');

    // Before delivery, the notification is still 'pending' status (approval resolved, push not yet delivered).
    const before = await getPool().query(`SELECT status, delivered_count FROM notifications WHERE id = $1`, [opened.id]);
    assert.equal(before.rows[0].status, 'pending');
    assert.equal(before.rows[0].delivered_count, 0);

    // Now simulate the fanout worker running once, from the memory_events row it would have received.
    const delivered = await deliverMemoryEvent({ entity_type: 'notification', entity_id: opened.id, action: 'approved' });
    assert.equal(delivered, true);

    const after = await getPool().query(`SELECT status, delivered_count FROM notifications WHERE id = $1`, [opened.id]);
    assert.equal(after.rows[0].status, 'delivered');
    assert.equal(after.rows[0].delivered_count, 1);

    // Delivery touched only `notifications` — the memory already verified above is untouched.
    const memoryRowAfter = await getPool().query(
      `SELECT r.id, r.content FROM memory_records r
       JOIN memory_embeddings e ON e.entity_id = r.id
       WHERE r.content = $1`,
      [decisionText],
    );
    assert.deepEqual(memoryRowAfter.rows, memoryRow.rows);
  } finally {
    await closePool();
  }
});
