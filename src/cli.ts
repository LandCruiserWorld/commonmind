#!/usr/bin/env node

/** Minimal command-line interface for the capture -> recall gate. */

import { closePool } from './db.js';
import { createEmbeddingProvider } from './embed.js';
import { MemoryRepository, type ApprovalRecord } from './memory/repository.js';
import { randomUUID } from 'node:crypto';
import { login, logout } from './login.js';
import { readHostedConfig, hostedCapture, hostedSearch } from './hosted.js';

const USAGE = `CommonMind — the memory layer for the agentic workforce

Usage: commonmind <command> [args]

Account
  login                            Connect this machine to the hosted service
  logout                           Forget the saved credentials

Memory
  capture "<text>"                 Capture a memory (row + embedding, one transaction)
  ask "<text>"                     Semantic recall, ranked by similarity
  ask --approval "<text>"          Open an approval and wait for the decision
  decide <id> approved|denied      Resolve a pending approval

Servers
  serve-mcp                        MCP server over stdio (Claude Code, Claude Desktop)
  serve-inbox                      HTTP API — POST /api/memory/capture, GET /api/memory/search
  serve-cdc-bridge                 CDC changefeed bridge to SNS

After 'login', capture and ask run against the hosted service. Without it they
talk straight to your own cluster using .env:

  COCKROACH_DB_URL                 CockroachDB connection string
  COMMONMIND_API_TOKEN             Bearer token for the HTTP API
  EMBED_PROVIDER                   local | bedrock   (default: local)

Docs: https://github.com/LandCruiserWorld/commonmind`;

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const [command, ...commandArgs] = args;

  // No command, or an explicit ask for help: print usage rather than exiting
  // silently. A bare `commonmind` that does nothing reads as broken.
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  if (command === 'login') {
    await login();
    return;
  }

  if (command === 'logout') {
    logout();
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

  // Hosted mode short-circuits before any pool is opened — a cm_ token talks
  // to the REST bridge only, never to CockroachDB directly.
  const hosted = readHostedConfig();
  if (hosted && (command === 'capture' || command === 'ask')) {
    const text = commandArgs.filter((arg) => arg !== '--approval').join(' ').trim();
    if (!text) throw new Error(`Usage: commonmind ${command} "<text>"`);

    if (command === 'capture') {
      console.log(await hostedCapture(hosted, text));
      return;
    }

    const matches = await hostedSearch(hosted, text);
    if (!matches.length) {
      console.log('No matches.');
      return;
    }
    for (const match of matches) {
      const score = typeof match.score === 'number' ? match.score.toFixed(4) : '   -  ';
      console.log(`${score}\t${match.content}`);
    }
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

// `dist/cli.js` is only ever the bin entrypoint — the library surface is
// `index.js` — so run unconditionally. The argv[1]/import.meta.url guard this
// replaces silently did nothing under a global install's bin symlink.
runCli().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});