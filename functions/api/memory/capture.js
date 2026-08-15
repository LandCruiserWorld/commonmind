/**
 * POST /api/memory/capture — authenticated bridge to Kousik's CommonMind API.
 *
 * The browser never sees the shared bearer token (COMMONMIND_API_TOKEN in
 * src/inbox/server.ts on his side). This function holds it server-side,
 * checks who's signed in via the D1 session, and forwards the write
 * tagged with that user's owner_id.
 *
 * PROVISIONAL: owner_id is sent as an `X-CommonMind-Owner` header. This is
 * the one piece still waiting on Kousik — his API needs to (a) accept a
 * per-request owner_id once tenant isolation lands, and (b) confirm this is
 * the header/field shape he wants. One line to change here once he answers.
 *
 * Requires two secrets on this Pages project (`wrangler pages secret put`):
 *   COMMONMIND_API_URL   — base URL of the deployed capture/search API
 *   COMMONMIND_API_TOKEN — the shared bearer token from his side
 */

import { requireUser } from '../../_lib/session.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }
  if (!env.COMMONMIND_API_URL || !env.COMMONMIND_API_TOKEN) {
    console.error('capture bridge misconfigured: missing COMMONMIND_API_URL/COMMONMIND_API_TOKEN');
    return json({ error: 'CommonMind backend not configured yet' }, 503);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!payload || typeof payload !== 'object') {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const upstream = await fetch(`${env.COMMONMIND_API_URL.replace(/\/$/, '')}/api/memory/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.COMMONMIND_API_TOKEN}`,
      'X-CommonMind-Owner': user.id,
    },
    body: JSON.stringify(payload),
  });

  const body = await upstream.text();

  // Log real activity for the network map — only when a project (not the
  // dashboard's own session) did the capturing, and only on real success.
  if (user.projectId && upstream.ok) {
    let memoryId = null;
    try {
      memoryId = JSON.parse(body)?.id ?? null;
    } catch {}
    context.waitUntil(
      env.DB.prepare(
        'INSERT INTO project_activity (id, project_id, action, memory_id) VALUES (?, ?, ?, ?)',
      )
        .bind(crypto.randomUUID(), user.projectId, 'capture', memoryId)
        .run()
        .catch(() => {}),
    );
  }

  return new Response(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
