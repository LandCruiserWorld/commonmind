/**
 * GET  /api/projects — list the signed-in user's connected projects
 * POST /api/projects — create one, returns the token
 *
 * Keys are revealable later — GET /api/projects/:id returns the token again.
 * Session-only (cookie) — creating a project key requires being in the
 * browser, signed in. A project token can't create another project token.
 */

import { requireUser } from '../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireCookieUser(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const { results } = await env.DB.prepare(
    `SELECT id, name, created_at, last_used_at, token
     FROM project_tokens
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
  )
    .bind(user.id)
    .all();

  // Never re-expose the real token — just enough of a suffix to tell keys
  // apart in a list, same as Stripe/GitHub show a truncated key.
  const projects = results.map(({ token, ...rest }) => ({
    ...rest,
    last4: token.slice(-4),
  }));

  return json({ projects }, 200);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await requireCookieUser(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return json({ error: 'Project name is required' }, 400);
  if (name.length > 80) return json({ error: 'Project name is too long' }, 400);

  const id = crypto.randomUUID();
  const token = `cm_${randomHex(32)}`;

  await env.DB.prepare(
    'INSERT INTO project_tokens (id, user_id, name, token) VALUES (?, ?, ?, ?)',
  )
    .bind(id, user.id, name, token)
    .run();

  return json({ id, name, token }, 201);
}

// Project creation is deliberately cookie-only — see file header. A thin
// wrapper over requireUser that rejects anything that came in as a bearer
// project token, so a key can never mint another key.
async function requireCookieUser(request, env) {
  if (request.headers.get('Authorization')) return null;
  return requireUser(request, env);
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
