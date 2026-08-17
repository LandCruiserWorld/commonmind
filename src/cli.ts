#!/usr/bin/env node

/** Minimal command-line interface for the capture -> recall gate. */

import { closePool } from './db.js';
import { createEmbeddingProvider } from './embed.js';
import { MemoryRepository, type ApprovalRecord } from './memory/repository.js';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const USAGE = `CommonMind — the memory layer for the agentic workforce

Usage: commonmind <command> [args]

Memory
  capture "<text>"                 Capture a memory (row + embedding, one transaction)
  ask "<text>"                     Semantic recall, ranked by similarity
  ask --approval "<text>"          Open an approval and wait for the decision
  decide <id> approved|denied      Resolve a pending approval

Servers
  serve-mcp                        MCP server over stdio (Claude Code, Claude Desktop)
  serve-inbox                      HTTP API — POST /api/memory/capture, GET /api/memory/search
  serve-cdc-bridge                 CDC changefeed bridge to SNS

Setup
  COCKROACH_DB_URL                 CockroachDB connection string
  COMMONMIND_API_TOKEN             Bearer token for the HTTP API
  EMBED_PROVIDER                   local | bedrock   (default: local)

  Copy .env.example to .env and fill those in.

Docs: https://github.com/LandCruiserWorld/commonmind`;

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const [command, ...commandArgs] = args;

  // No command, or an explicit ask for help: print usage rather than exiting
  // silently. A bare `commonmind` that does nothing reads as broken.
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  if (command === 'serve-mcp') {
    const { serveMcp } = await import(new URL('./mcp.js', import.meta.url).href);
    await serveMcp();
    return;
  }

  if (command === 'serve-inbox') {
    const { serveInbox } = await import(new URL('./inbox/server.js', import.meta.url).href);
    await serveInbox();
    return;
  }

  if (command === 'serve-cdc-bridge') {
    const { serveBridge } = await import(new URL('./cdc/bridge.js', import.meta.url).href);
    await serveBridge();
    return;
  }

  const memories = new MemoryRepository();

  try {
    if (command === 'capture') {
      const text = commandArgs.join(' ').trim();
      if (!text) throw new Error('Usage: commonmind capture "<text>"');
      const embedding = await createEmbeddingProvider().embed(text);
      const id = await memories.remember(text, 'decision', embedding);
      console.log(id);
      return;
    }

    if (command === 'decide') {
      const [correlationId, decision] = commandArgs;
      if (!correlationId || (decision !== 'approved' && decision !== 'denied')) {
        throw new Error('Usage: commonmind decide <correlation-id> approved|denied');
      }
      const approval = await memories.readApproval(correlationId);
      if (!approval) throw new Error(`Unknown approval: ${correlationId}`);
      const embedding = await createEmbeddingProvider().embed(
        `Approval ${approval.correlationId} was ${decision}: ${approval.body}`,
      );
      console.log((await memories.decideApproval(correlationId, decision, embedding)).status);
      return;
    }

    if (command === 'ask') {
      const approvalArgs = parseApprovalArgs(commandArgs);
      if (approvalArgs) {
        const correlationId = approvalArgs.correlationId ?? randomUUID();
        const approval = await memories.openApproval(
          approvalArgs.body,
          correlationId,
          new Date(Date.now() + approvalArgs.expiresInSeconds * 1_000),
        );
        console.log(`approval ${approval.id}\tcorrelation_id=${approval.correlationId}`);
        console.log((await waitForApproval(memories, approval)).status);
        return;
      }

      const text = commandArgs.join(' ').trim();
      if (!text) throw new Error('Usage: commonmind ask "<text>" | commonmind ask --approval "<text>"');
      const embedding = await createEmbeddingProvider().embed(text);
      const matches = await memories.recall(embedding);
      for (const match of matches) {
        console.log(`${match.score.toFixed(4)}\t${match.content}`);
      }
      return;
    }

    throw new Error(`Unknown command: ${command}\n\nRun \`commonmind help\` for usage.`);
  } finally {
    await closePool();
  }
}

function parseApprovalArgs(args: string[]): { body: string; correlationId?: string; expiresInSeconds: number } | null {
  if (!args.includes('--approval')) return null;

  let correlationId: string | undefined;
  let expiresInSeconds = 900;
  const body: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--approval') continue;
    if (arg === '--correlation-id') {
      correlationId = args[++index];
      if (!correlationId) throw new Error('Missing value for --correlation-id');
      continue;
    }
    if (arg === '--expires-in') {
      expiresInSeconds = Number(args[++index]);
      if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
        throw new Error('--expires-in must be a positive number of seconds');
      }
      continue;
    }
    body.push(arg);
  }
  const text = body.join(' ').trim();
  if (!text) throw new Error('Usage: commonmind ask --approval "<text>"');
  return { body: text, correlationId, expiresInSeconds };
}

async function waitForApproval(memories: MemoryRepository, approval: ApprovalRecord): Promise<ApprovalRecord> {
  let current = approval;
  while (current.status === 'pending') {
    await new Promise((resolve) => setTimeout(resolve, 250));
    current = await memories.readApproval(approval.correlationId) ?? current;
  }
  return current;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}