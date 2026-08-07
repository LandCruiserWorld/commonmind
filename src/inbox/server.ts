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

export function createInboxServer(): Server {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const path = request.url?.split('?')[0];

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
    server.listen(port, '127.0.0.1', resolve);
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
