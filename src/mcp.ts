/** Minimal JSON-only Streamable HTTP MCP server. */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { closePool } from './db.js';
import { createEmbeddingProvider } from './embed.js';
import { MemoryRepository } from './memory/repository.js';
import type { EntityType } from './memory/types.js';

const PROTOCOL_VERSION = '2025-11-25';

export async function serveMcp(port = Number(process.env.COMMONMIND_MCP_PORT ?? '3333')): Promise<void> {
  const server = createMcpServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  server.once('close', () => void closePool());
  console.error(`CommonMind MCP listening at http://127.0.0.1:${port}/mcp`);
  await new Promise<void>((resolve) => server.once('close', resolve));
}

export function createMcpServer(): Server {
  const memories = new MemoryRepository();
  const embeddings = createEmbeddingProvider();

  return createServer(async (request, response) => {
    if (request.url?.split('?')[0] !== '/mcp') {
      response.writeHead(404).end();
      return;
    }
    if (!isLocalOrigin(request)) {
      response.writeHead(403).end();
      return;
    }
    if (request.method === 'GET') {
      response.writeHead(405, { Allow: 'POST' }).end();
      return;
    }
    if (request.method !== 'POST') {
      response.writeHead(405, { Allow: 'POST' }).end();
      return;
    }

    try {
      const message = await readJson(request);
      if (!isMessage(message)) {
        sendJson(response, 400, error(null, -32600, 'Invalid JSON-RPC message'));
        return;
      }
      if (message.id === undefined) {
        response.writeHead(202).end();
        return;
      }
      sendJson(response, 200, await handleRequest(message, memories, embeddings));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Invalid request';
      sendJson(response, 400, error(null, -32700, message));
    }
  });
}

async function handleRequest(
  request: JsonRpcRequest,
  memories: MemoryRepository,
  embeddings: Awaited<ReturnType<typeof createEmbeddingProvider>>,
): Promise<JsonRpcResponse> {
  if (request.method === 'initialize') {
    return result(request.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'commonmind', version: '0.1.0' },
    });
  }
  if (request.method === 'tools/list') {
    return result(request.id, { tools: tools() });
  }
  if (request.method === 'tools/call') {
    const params = object(request.params);
    try {
      return result(request.id, await callTool(
        String(params.name ?? ''),
        object(params.arguments),
        memories,
        embeddings,
      ));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Tool failed';
      return result(request.id, { content: [{ type: 'text', text: message }], isError: true });
    }
  }
  return error(request.id, -32601, `Method not found: ${request.method}`);
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  memories: MemoryRepository,
  embeddings: Awaited<ReturnType<typeof createEmbeddingProvider>>,
): Promise<Record<string, unknown>> {
  if (name === 'memory.capture') {
    const content = requiredString(args, 'content');
    const entityType = validEntityType(args.entityType) ? args.entityType : 'decision';
    const id = await memories.remember(content, entityType, await embeddings.embed(content));
    return toolResult({ id });
  }
  if (name === 'memory.recall') {
    const query = requiredString(args, 'query');
    const limit = typeof args.limit === 'number' && Number.isInteger(args.limit) ? args.limit : 8;
    const matches = await memories.recall(await embeddings.embed(query), limit);
    return toolResult({ matches });
  }
  if (name === 'memory.ask') {
    const body = requiredString(args, 'body');
    const correlationId = typeof args.correlationId === 'string' ? args.correlationId : randomUUID();
    const expiresInSeconds = typeof args.expiresInSeconds === 'number' && args.expiresInSeconds > 0
      ? args.expiresInSeconds
      : 900;
    const approval = await memories.openApproval(
      body,
      correlationId,
      new Date(Date.now() + expiresInSeconds * 1_000),
    );
    return toolResult(approval);
  }
  if (name === 'memory.approve') {
    const correlationId = requiredString(args, 'correlationId');
    const decision = args.decision;
    if (decision !== 'approved' && decision !== 'denied') {
      throw new Error('decision must be "approved" or "denied"');
    }
    const approval = await memories.readApproval(correlationId);
    if (!approval) throw new Error(`Unknown approval: ${correlationId}`);
    const decisionEmbedding = await embeddings.embed(
      `Approval ${approval.correlationId} was ${decision}: ${approval.body}`,
    );
    return toolResult(await memories.decideApproval(correlationId, decision, decisionEmbedding));
  }
  if (name === 'memory.note') {
    const content = requiredString(args, 'content');
    const visibility = args.visibility === 'public' ? 'public' : 'private';
    const id = await memories.note(content, visibility, await embeddings.embed(content));
    return toolResult({ id, visibility });
  }
  throw new Error(`Unknown tool: ${name}`);
}

function tools(): Array<Record<string, unknown>> {
  return [
    {
      name: 'memory.capture',
      description: 'Atomically capture a memory and its embedding.',
      inputSchema: {
        type: 'object',
        properties: { content: { type: 'string' }, entityType: { type: 'string' } },
        required: ['content'],
      },
    },
    {
      name: 'memory.recall',
      description: 'Recall semantically similar memories.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'integer' } },
        required: ['query'],
      },
    },
    {
      name: 'memory.ask',
      description: 'Open or resume a durable human approval request.',
      inputSchema: {
        type: 'object',
        properties: {
          body: { type: 'string' },
          correlationId: { type: 'string' },
          expiresInSeconds: { type: 'number' },
        },
        required: ['body'],
      },
    },
    {
      name: 'memory.approve',
      description: 'Record a human decision on an open approval; resumes the agent and commits the decision as memory.',
      inputSchema: {
        type: 'object',
        properties: {
          correlationId: { type: 'string' },
          decision: { type: 'string', enum: ['approved', 'denied'] },
        },
        required: ['correlationId', 'decision'],
      },
    },
    {
      name: 'memory.note',
      description: 'Contribute a note to the company brain. public grows the shared recall index; private is contributor-only.',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          visibility: { type: 'string', enum: ['public', 'private'] },
        },
        required: ['content'],
      },
    },
  ];
}

function toolResult(value: unknown): Record<string, unknown> {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function requiredString(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`);
  return value;
}

function validEntityType(value: unknown): value is EntityType {
  return value === 'notification' || value === 'incident' || value === 'runbook' || value === 'decision';
}

function isLocalOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  return !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => { body += chunk; });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response: ServerResponse, status: number, value: JsonRpcResponse): void {
  response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isMessage(value: unknown): value is JsonRpcRequest {
  const message = object(value);
  return message.jsonrpc === '2.0' && typeof message.method === 'string';
}

function result(id: JsonRpcId, value: Record<string, unknown>): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result: value };
}

function error(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
}
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}
