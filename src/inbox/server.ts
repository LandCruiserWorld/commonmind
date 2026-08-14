/**
 * Minimal web inbox — the InboxProvider MVP push surface.
 *
 * Unstyled by design (Friday's gate is the pipeline, not the UI). Reads
 * `notifications` straight from CockroachDB and polls; it does not receive
 * pushes from the fanout worker directly, so it stays up even if the fanout
 * Lambda is gone — it just shows rows however far delivery got.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { getPool } from '../db.js';
import { loadConfig } from '../config.js';
import { createEmbeddingProvider } from '../embed.js';
import { MemoryRepository } from '../memory/repository.js';

export function createInboxServer(): Server {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const path = request.url?.split('?')[0];

    if (path === '/api/memory/capture' && request.method === 'POST') {
      const auth = request.headers.authorization ?? '';
      if (auth !== `Bearer ${loadConfig().apiToken}`) {
        response.writeHead(401, { 'Content-Type': 'application/json' }).end('{"error":"unauthorized"}');
        return;
      }

      let raw = '';
      for await (const chunk of request) raw += chunk;

      let dream: Record<string, unknown>;
      try {
        dream = JSON.parse(raw);
      } catch {
        response.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"invalid json"}');
        return;
      }

      // KeenDreams dreams carry the episode text under one of these keys;
      // fall back to the whole payload so nothing is silently dropped.
      const content =
        typeof dream.lesson === 'string' ? dream.lesson :
        typeof dream.content === 'string' ? dream.content :
        typeof dream.text === 'string' ? dream.text :
        JSON.stringify(dream);

      try {
        const embedding = await createEmbeddingProvider().embed(content);
        const id = await new MemoryRepository().remember(content, 'decision', embedding);
        response.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, id }));
      } catch (err) {
        console.error('capture_failed', err);
        response.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"capture failed"}');
      }
      return;
    }

    if (path === '/api/memory/search' && request.method === 'GET') {
      const auth = request.headers.authorization ?? '';
      if (auth !== `Bearer ${loadConfig().apiToken}`) {
        response.writeHead(401, { 'Content-Type': 'application/json' }).end('{"error":"unauthorized"}');
        return;
      }

      const params = new URL(request.url ?? '/', 'http://localhost').searchParams;
      const query = params.get('q') ?? params.get('query') ?? '';
      const limit = Number(params.get('limit') ?? params.get('top_k') ?? '3');

      if (!query) {
        response.writeHead(400, { 'Content-Type': 'application/json' }).end('{"error":"missing q"}');
        return;
      }

      try {
        const embedding = await createEmbeddingProvider().embed(query);
        const results = await new MemoryRepository().recall(embedding, limit);
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ results }));
      } catch (err) {
        console.error('search_failed', err);
        response.writeHead(500, { 'Content-Type': 'application/json' }).end('{"error":"search failed"}');
      }
      return;
    }

    if (path === '/api/notifications' && request.method === 'GET') {
      const rows = await getPool().query(
        `SELECT id, body, status, response_status, correlation_id, created_at
         FROM notifications
         ORDER BY created_at DESC
         LIMIT 50`,
      );
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(rows.rows));
      return;
    }

    if (path === '/' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/html' }).end(INBOX_HTML);
      return;
    }

    response.writeHead(404).end();
  });
}

export async function serveInbox(port = Number(process.env.COMMONMIND_INBOX_PORT ?? '3334')): Promise<void> {
  const server = createInboxServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  console.error(`CommonMind inbox listening at http://127.0.0.1:${port}/`);
  await new Promise<void>((resolve) => server.once('close', resolve));
}

const INBOX_HTML = `<!doctype html>
<html>
<head><title>CommonMind Inbox</title></head>
<body>
<h1>CommonMind Inbox</h1>
<ul id="list"></ul>
<script>
async function refresh() {
  const rows = await (await fetch('/api/notifications')).json();
  document.getElementById('list').innerHTML = rows.map(function (r) {
    var state = r.status + (r.response_status ? '/' + r.response_status : '');
    return '<li>' + r.created_at + ' — ' + r.body + ' [' + state + ']</li>';
  }).join('');
}
refresh();
setInterval(refresh, 3000);
</script>
</body>
</html>`;