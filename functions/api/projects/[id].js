/**
 * GET    /api/projects/:id — reveal the key again (see file-level note in
 *        index.js: it's stored raw, so re-showing it doesn't weaken anything
 *        that wasn't already true — a deliberate UX choice, not an oversight).
 * DELETE /api/projects/:id — revoke a project key. Session-only, same
 * reasoning as creation: a project token can't revoke keys either.
 */

import { requireUser } from '../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (request.headers.get('Authorization')) {
    return json({ error: 'Not authenticated' }, 401);
  }
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const project = await env.DB.prepare(
    `SELECT id, name, token, created_at, last_used_at
     FROM project_tokens
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(params.id, user.id)
    .first();

  if (!project) return json({ error: 'Project not found' }, 404);
  return json(project, 200);
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  if (request.headers.get('Authorization')) {
    return json({ error: 'Not authenticated' }, 401);
  }
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const result = await env.DB.prepare(
    `UPDATE project_tokens SET revoked_at = datetime('now')
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(params.id, user.id)
    .run();

  if (!result.meta.changes) {
    return json({ error: 'Project not found' }, 404);
  }
  return json({ ok: true }, 200);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
