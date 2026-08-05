#!/usr/bin/env node

/** Minimal command-line interface for the capture -> recall gate. */

import { closePool } from './db.js';
import { createEmbeddingProvider } from './embed.js';
import { MemoryRepository } from './memory/repository.js';
import { pathToFileURL } from 'node:url';

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const [command, ...textParts] = args;
  const text = textParts.join(' ').trim();

  if ((command !== 'capture' && command !== 'ask') || !text) {
    throw new Error('Usage: commonmind capture "<text>" | commonmind ask "<text>"');
  }

  const embedding = await createEmbeddingProvider().embed(text);
  const memories = new MemoryRepository();

  try {
    if (command === 'capture') {
      const id = await memories.remember(text, 'decision', embedding);
      console.log(id);
      return;
    }

    const matches = await memories.recall(embedding);
    for (const match of matches) {
      console.log(`${match.score.toFixed(4)}\t${match.content}`);
    }
  } finally {
    await closePool();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
