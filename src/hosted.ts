/**
 * Hosted mode: credentials from `commonmind login`.
 *
 * When ~/.commonmind/config exists the CLI talks to the hosted REST bridge
 * instead of dialling CockroachDB directly. The .env path is untouched for
 * anyone who never runs `login`.
 */

import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface HostedConfig {
  url: string;
  token: string;
}

const CONFIG_DIR = join(homedir(), '.commonmind');
const CONFIG_PATH = join(CONFIG_DIR, 'config');

export function readHostedConfig(): HostedConfig | null {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<HostedConfig>;
    if (typeof parsed.url === 'string' && typeof parsed.token === 'string') {
      return { url: parsed.url.replace(/\/$/, ''), token: parsed.token };
    }
    return null;
  } catch {
    return null;
  }
}

/** chmod 600 — this file holds a live credential. */
export function writeHostedConfig(config: HostedConfig): string {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  chmodSync(CONFIG_PATH, 0o600);
  return CONFIG_PATH;
}

export function clearHostedConfig(): boolean {
  try {
    rmSync(CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
}

export async function hostedCapture(config: HostedConfig, content: string): Promise<string> {
  const response = await fetch(`${config.url}/api/memory/capture`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error(`Capture failed (${response.status}): ${await response.text()}`);
  const body = await response.json() as { id?: string };
  return body.id ?? '(captured)';
}

export async function hostedSearch(
  config: HostedConfig,
  query: string,
  limit = 8,
): Promise<Array<{ content: string; score?: number }>> {
  const url = `${config.url}/api/memory/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${config.token}` } });
  if (!response.ok) throw new Error(`Search failed (${response.status}): ${await response.text()}`);
  const body = await response.json() as { results?: Array<{ content: string; score?: number }> };
  return body.results ?? [];
}