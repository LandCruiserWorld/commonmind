/**
 * Text embedding providers.
 *
 * Every embedding is validated before it can reach CockroachDB's
 * VECTOR(1024) column. The local provider is deterministic for development;
 * Bedrock uses Titan Text Embeddings V2 in deployed environments.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  type BedrockRuntimeClientConfig,
} from '@aws-sdk/client-bedrock-runtime';
import { loadConfig, type Config } from './config.js';

export const EMBEDDING_DIMENSIONS = 1024;

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

/** Reject values CockroachDB's VECTOR(1024) column cannot safely store. */
export function validateEmbedding(embedding: unknown): number[] {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding must contain exactly ${EMBEDDING_DIMENSIONS} values`);
  }
  if (!embedding.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error('Embedding values must all be finite numbers');
  }
  return embedding;
}

/** A stable, dependency-free embedding for local development and tests. */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const embedding = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
    const tokens = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [''];

    for (const token of tokens) {
      for (let projection = 0; projection < 4; projection += 1) {
        const hash = hashToken(token, projection + 1);
        const index = hash % EMBEDDING_DIMENSIONS;
        embedding[index] += (hash & 1) === 0 ? 1 : -1;
      }
    }

    const magnitude = Math.hypot(...embedding);
    if (magnitude > 0) {
      for (let index = 0; index < embedding.length; index += 1) {
        embedding[index] /= magnitude;
      }
    }
    return validateEmbedding(embedding);
  }
}

/** Titan Text Embeddings V2 through Amazon Bedrock. */
export class BedrockEmbeddingProvider implements EmbeddingProvider {
  private readonly client: BedrockRuntimeClient;

  constructor(
    private readonly modelId: string,
    clientConfig: BedrockRuntimeClientConfig,
  ) {
    this.client = new BedrockRuntimeClient(clientConfig);
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.send(new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text,
        dimensions: EMBEDDING_DIMENSIONS,
        normalize: true,
      }),
    }));

    if (!response.body) {
      throw new Error('Bedrock returned an empty embedding response');
    }

    const payload: unknown = JSON.parse(new TextDecoder().decode(response.body));
    const embedding = isEmbeddingResponse(payload) ? payload.embedding : undefined;
    return validateEmbedding(embedding);
  }
}

/** Select the configured provider without exposing provider details to callers. */
export function createEmbeddingProvider(config: Config = loadConfig()): EmbeddingProvider {
  if (config.embedProvider === 'bedrock') {
    return new BedrockEmbeddingProvider(config.bedrockEmbedModelId ?? '', {
      region: config.awsRegion,
    });
  }
  return new LocalEmbeddingProvider();
}

function hashToken(token: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = Math.imul(hash ^ token.charCodeAt(index), 16777619) >>> 0;
  }
  return hash;
}

function isEmbeddingResponse(value: unknown): value is { embedding: unknown } {
  return typeof value === 'object' && value !== null && 'embedding' in value;
}
