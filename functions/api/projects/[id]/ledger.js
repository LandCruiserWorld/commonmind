/**
 * GET /api/projects/:id/ledger?cursor=&limit= — browse a project's own
 * memories directly, most recent first. This is the "list everything"
 * view the upstream memory core doesn't have (it only does semantic
 * search) — backed entirely by project_activity.content, stored at
 * capture time (see capture.js). Session-only, same reasoning as every
 * other project-management route in this directory.
 */

import { requireUser } from '../../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (request.headers.get('Authorization')) {
    return json({ error: 'Not authenticated' }, 401);
  }
  const user = await requireUser(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const project = await env.DB.prepare(
    `SELECT id, name FROM project_tokens WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(params.id, user.id)
    .first();
  if (!project) return json({ error: 'Project not found' }, 404);

  const url = new URL(request.url);
  // Was capped at 100 — for a project with more real memories than that
  // (Ocean Dreams has 600+), that silently showed a sample as if it were
  // the whole thing. No sugar-coating: show what's actually there.
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '20', 10) || 20, 1), 2000);
  const cursor = url.searchParams.get('cursor'); // an ISO created_at value; rows strictly older than this

  const rows = cursor
    ? await env.DB.prepare(
        `SELECT pa.id, pa.memory_id, pa.content, pa.created_at
         FROM project_activity pa
         WHERE pa.project_id = ? AND pa.action = 'capture' AND pa.created_at < ?
           AND (pa.memory_id IS NULL
                OR pa.memory_id NOT IN (SELECT memory_id FROM hidden_memories WHERE user_id = ?))
         ORDER BY pa.created_at DESC
         LIMIT ?`,
      )
        .bind(params.id, cursor, user.id, limit + 1)
        .all()
    : await env.DB.prepare(
        `SELECT pa.id, pa.memory_id, pa.content, pa.created_at
         FROM project_activity pa
         WHERE pa.project_id = ? AND pa.action = 'capture'
           AND (pa.memory_id IS NULL
                OR pa.memory_id NOT IN (SELECT memory_id FROM hidden_memories WHERE user_id = ?))
         ORDER BY pa.created_at DESC
         LIMIT ?`,
      )
        .bind(params.id, user.id, limit + 1)
        .all();

  const results = rows.results ?? [];
  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;

  return json(
    {
      project: { id: project.id, name: project.name },
      entries: page.map((r) => ({
        id: r.memory_id || r.id, // memory_id is what delete needs; fall back to the activity row id if somehow missing
        content: r.content, // null on rows captured before content-storage existed
        createdAt: r.created_at,
      })),
      nextCursor: hasMore ? page[page.length - 1].created_at : null,
    },
    200,
  );
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
