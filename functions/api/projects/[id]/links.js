/**
 * GET  /api/projects/:id/links — list this user's other projects, each
 *      flagged whether it currently shares memory with :id.
 * POST /api/projects/:id/links — body { targetProjectId, linked: bool }.
 *      Turns shared recall on/off between the two projects. Symmetric: a
 *      link makes each project's search able to see the other's captures.
 *
 * Session-only, same reasoning as everywhere else in this directory: a
 * project token can manage its own key, never another project's sharing.
 */

import { requireUser } from '../../../_lib/session.js';

async function requireCookieUser(request, env) {
  if (request.headers.get('Authorization')) return null;
  return requireUser(request, env);
}

// Canonical, order-independent pair id — always store the lexicographically
// smaller id first so (A,B) and (B,A) resolve to the same row.
function pair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const user = await requireCookieUser(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const project = await env.DB.prepare(
    `SELECT id FROM project_tokens WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(params.id, user.id)
    .first();
  if (!project) return json({ error: 'Project not found' }, 404);

  const { results: others } = await env.DB.prepare(
    `SELECT id, name FROM project_tokens
     WHERE user_id = ? AND id != ? AND revoked_at IS NULL
     ORDER BY created_at ASC`,
  )
    .bind(user.id, params.id)
    .all();

  const { results: linkRows } = await env.DB.prepare(
    `SELECT project_a, project_b FROM project_links WHERE project_a = ? OR project_b = ?`,
  )
    .bind(params.id, params.id)
    .all();
  const linkedIds = new Set(
    linkRows.map((r) => (r.project_a === params.id ? r.project_b : r.project_a)),
  );

  return json(
    { projects: others.map((p) => ({ id: p.id, name: p.name, linked: linkedIds.has(p.id) })) },
    200,
  );
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const user = await requireCookieUser(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const targetId = body?.targetProjectId;
  const linked = !!body?.linked;
  if (!targetId || targetId === params.id) {
    return json({ error: 'Invalid targetProjectId' }, 400);
  }

  // Both projects must belong to this user — no linking someone else's key.
  const owned = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM project_tokens
     WHERE user_id = ? AND revoked_at IS NULL AND id IN (?, ?)`,
  )
    .bind(user.id, params.id, targetId)
    .first();
  if (!owned || owned.n !== 2) return json({ error: 'Project not found' }, 404);

  const [a, b] = pair(params.id, targetId);

  if (linked) {
    await env.DB.prepare(
      `INSERT INTO project_links (id, project_a, project_b, user_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(project_a, project_b) DO NOTHING`,
    )
      .bind(crypto.randomUUID(), a, b, user.id)
      .run();
  } else {
    await env.DB.prepare(`DELETE FROM project_links WHERE project_a = ? AND project_b = ?`)
      .bind(a, b)
      .run();
  }

  return json({ ok: true, linked }, 200);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
