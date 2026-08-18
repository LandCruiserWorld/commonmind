/**
 * `commonmind login` — browser-based auth against the hosted service.
 *
 * The browser hop only ever carries an opaque code; the real cm_ token is
 * fetched server-to-server by this process via /api/cli/exchange, so the
 * credential never touches the URL bar, browser history, or a local access log.
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { spawn } from 'node:child_process';
import { writeHostedConfig, clearHostedConfig, readHostedConfig } from './hosted.js';

const HOSTED_URL = process.env.COMMONMIND_HOSTED_URL ?? 'https://commonmind.agent9.dev';
const TIMEOUT_MS = 5 * 60 * 1000;

const DONE_PAGE = `<!doctype html><html><head><title>CommonMind</title></head>
<body style="font-family:system-ui;text-align:center;padding-top:4rem">
<h2>Connected</h2><p>You can close this tab.</p></body></html>`;

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  try {
    spawn(command, [url], { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* headless or no browser — the printed URL is the fallback */
  }
}

/** Wait for the browser redirect on loopback. Never binds beyond 127.0.0.1. */
function awaitCallback(expectedState: string): { port: Promise<number>; code: Promise<string> } {
  let resolvePort: (port: number) => void;
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;

  const port = new Promise<number>((resolve) => { resolvePort = resolve; });
  const code = new Promise<string>((resolve, reject) => { resolveCode = resolve; rejectCode = reject; });

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/callback') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html' }).end(DONE_PAGE);
    server.close();

    const returnedState = url.searchParams.get('state');
    const returnedCode = url.searchParams.get('code');
    if (returnedState !== expectedState) {
      rejectCode(new Error('State mismatch — aborting without exchanging the code.'));
      return;
    }
    if (!returnedCode) {
      rejectCode(new Error('No code in the callback.'));
      return;
    }
    resolveCode(returnedCode);
  });

  const timer = setTimeout(() => {
    server.close();
    rejectCode(new Error('Timed out after 5 minutes. Run `commonmind login` again.'));
  }, TIMEOUT_MS);
  timer.unref();

  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address === 'object') resolvePort(address.port);
  });

  return { port, code };
}

export async function login(): Promise<void> {
  const state = randomBytes(16).toString('hex');
  const { port: portPromise, code: codePromise } = awaitCallback(state);
  const port = await portPromise;

  const authUrl = `${HOSTED_URL}/cli-auth/?port=${port}&state=${state}&label=${encodeURIComponent(hostname())}`;
  console.log(`Opening ${HOSTED_URL}/cli-auth/ in your browser… waiting for authorization.`);
  console.log(`If it doesn't open: ${authUrl}`);
  openBrowser(authUrl);

  const code = await codePromise;

  const response = await fetch(`${HOSTED_URL}/api/cli/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Exchange failed (${response.status}): ${body}`);
  }
  const { token, url } = await response.json() as { token: string; url: string };

  const path = writeHostedConfig({ url, token });
  console.log(`Logged in. Credentials saved to ${path}`);
  console.log(`Try 'commonmind capture "..."' or 'commonmind ask "..."'.`);
}

export function logout(): void {
  const existing = readHostedConfig();
  if (!existing) {
    console.log('Not logged in.');
    return;
  }
  console.log(clearHostedConfig() ? 'Logged out.' : 'Could not remove ~/.commonmind/config.');
}