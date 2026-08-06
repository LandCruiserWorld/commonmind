import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { closePool } from '../src/db.js';
import { createEmbeddingProvider } from '../src/embed.js';
import { createMcpServer } from '../src/mcp.js';
import { MemoryRepository } from '../src/memory/repository.js';

const runIntegration = process.env.RUN_APPROVAL_INTEGRATION_TESTS === '1';

test('approval round-trip, resume, expiry, and MCP capture', { skip: !runIntegration }, async () => {
  process.env.EMBED_PROVIDER = 'local';
  const memories = new MemoryRepository();
  const correlationId = `approval-test-${randomUUID()}`;
  const body = `approve deploy ${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 60_000);

  try {
    const opened = await memories.openApproval(body, correlationId, expiresAt);
    const resumed = await memories.openApproval(body, correlationId, expiresAt);
    assert.equal(resumed.id, opened.id);
    assert.equal(resumed.status, 'pending');

    const expiredId = `approval-expired-${randomUUID()}`;
    await memories.openApproval(`expired ${randomUUID()}`, expiredId, new Date(Date.now() - 1_000));
    assert.equal((await memories.expirePendingApproval(expiredId))?.status, 'expired');

    const decisionText = `Approval ${correlationId} was approved: ${body}`;
    const embedding = await createEmbeddingProvider().embed(decisionText);
    const decided = await memories.decideApproval(correlationId, 'approved', embedding);
    assert.equal(decided.status, 'approved');

    const recalled = await memories.recall(embedding);
    assert.ok(recalled.some((memory) => memory.content === decisionText));

    const server = createMcpServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'memory.capture', arguments: { content: `mcp ${randomUUID()}` } },
        }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as { result?: { structuredContent?: { id?: string } } };
      assert.ok(payload.result?.structuredContent?.id);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    await closePool();
  }
});
