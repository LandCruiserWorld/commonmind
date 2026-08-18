/**
 * POST /api/cli/code — mint a short-lived, single-use handoff code for
 * `commonmind login`. Called from /cli-auth/ once the signed-in user hits
 * "Authorize". The browser then redirects to the CLI's local callback with
 * this code, never the real project token — see cli_auth_codes in
 * docs/site/schema/auth.sql for why.
 *
 * Cookie-session only, same as project creation — a project token can't
 * mint a CLI code any more than it can mint another project token.
 *
 * Body: { projectId }  — the project just created (or chosen) for this
 * CLI login. The real token is read server-side from project_tokens; the
 * client only ever hands us an id, never the secret itself.
 */

import { requireUser } from '../../_lib/session.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (request.headers.get('Authorization')) {
    return json({ error: 'Not authenticated' }, 401);
  }
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
  if (!projectId) return json({ error: 'projectId is required' }, 400);

  const project = await env.DB.prepare(
    'SELECT id, token FROM project_tokens WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
  )
    .bind(projectId, user.id)
    .first();
  if (!project) return json({ error: 'Project not found' }, 404);

  const code = randomHex(32);
  const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes, single-use regardless

  await env.DB.prepare(
    'INSERT INTO cli_auth_codes (code, token, project_id, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(code, project.token, project.id, expiresAt)
    .run();

  return json({ code }, 201);
}

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
