import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { closePool, getPool } from '../src/db.js';
import { createEmbeddingProvider } from '../src/embed.js';
import { createMcpServer } from '../src/mcp.js';
import { MemoryRepository } from '../src/memory/repository.js';

const runIntegration = process.env.RUN_APPROVAL_INTEGRATION_TESTS === '1';

async function callTool(port: number, name: string, args: Record<string, unknown>) {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  return response.json() as Promise<{
    result?: { structuredContent?: Record<string, unknown>; isError?: boolean; content?: Array<{ text?: string }> };
  }>;
}

test('memory.approve resolves a pending approval and commits the decision as memory (Thursday state machine reused)', { skip: !runIntegration }, async () => {
  process.env.EMBED_PROVIDER = 'local';
  const memories = new MemoryRepository();
  const correlationId = `mcp-approve-${randomUUID()}`;
  const body = `deploy ${randomUUID()}`;

  const server = createMcpServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;

    const opened = await memories.openApproval(body, correlationId, new Date(Date.now() + 60_000));
    assert.equal(opened.status, 'pending');

    const payload = await callTool(port, 'memory.approve', { correlationId, decision: 'approved' });
    assert.equal(payload.result?.structuredContent?.status, 'approved');

    const decisionText = `Approval ${correlationId} was approved: ${body}`;
    const memoryRow = await getPool().query(`SELECT id FROM memory_records WHERE content = $1`, [decisionText]);
    assert.equal(memoryRow.rowCount, 1, 'the decision is committed as memory, same atomic path as `commonmind decide`');

    const embeddingRow = await getPool().query(
      `SELECT id FROM memory_embeddings WHERE entity_id = $1`,
      [memoryRow.rows[0].id],
    );
    assert.equal(embeddingRow.rowCount, 1, 'decision memory + embedding are atomic');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await closePool();
  }
});

test('memory.note: public grows the shared recall index; private is contributor-only (atomic with its embedding)', { skip: !runIntegration }, async () => {
  process.env.EMBED_PROVIDER = 'local';
  const memories = new MemoryRepository();
  const publicText = `public note ${randomUUID()}`;
  const privateText = `private note ${randomUUID()}`;

  const server = createMcpServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;

    const publicResult = await callTool(port, 'memory.note', { content: publicText, visibility: 'public' });
    const publicId = publicResult.result?.structuredContent?.id as string | undefined;
    assert.ok(publicId);
    assert.equal(publicResult.result?.structuredContent?.visibility, 'public');

    const privateResult = await callTool(port, 'memory.note', { content: privateText, visibility: 'private' });
    assert.ok(privateResult.result?.structuredContent?.id);
    assert.equal(privateResult.result?.structuredContent?.visibility, 'private');

    // Atomic write: row + embedding committed together, same invariant as remember().
    const embeddingRow = await getPool().query(`SELECT id FROM memory_embeddings WHERE entity_id = $1`, [publicId]);
    assert.equal(embeddingRow.rowCount, 1);

    const embedding = await createEmbeddingProvider().embed(publicText);
    const recalled = await memories.recall(embedding, 20);
    assert.ok(recalled.some((memory) => memory.content === publicText), 'public note grows the shared recall index');
    assert.ok(!recalled.some((memory) => memory.content === privateText), 'private note stays contributor-only');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await closePool();
  }
});
