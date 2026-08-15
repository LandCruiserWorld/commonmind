/**
 * GET /api/network — everything the network-map dashboard needs, computed
 * from real project_activity rows. No fixture data, no fabricated edges:
 * an edge only exists because a search from one project genuinely returned
 * a memory captured under a different project's key (see search.js).
 *
 * Session-only — this describes the signed-in user's own brain.
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  if (request.headers.get('Authorization')) {
    return json({ error: 'Not authenticated' }, 401);
  }
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/commonmind_session=([^;]+)/);
  if (!match) return json({ error: 'Not authenticated' }, 401);

  const session = await env.DB.prepare(
    `SELECT u.id FROM auth_tokens at JOIN users u ON at.user_id = u.id
     WHERE at.token = ? AND at.type = 'session' AND at.expires_at > datetime('now')`,
  )
    .bind(match[1])
    .first();
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const { results: projectRows } = await env.DB.prepare(
    `SELECT id, name, created_at, last_used_at
     FROM project_tokens
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created_at ASC`,
  )
    .bind(session.id)
    .all();

  const projects = [];
  for (const p of projectRows) {
    const counts = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN action = 'capture' THEN 1 ELSE 0 END) AS captures,
         SUM(CASE WHEN action = 'search' THEN 1 ELSE 0 END) AS searches,
         MAX(created_at) AS lastActivity
       FROM project_activity WHERE project_id = ?`,
    )
      .bind(p.id)
      .first();

    projects.push({
      id: p.id,
      name: p.name,
      captures: counts.captures || 0,
      searches: counts.searches || 0,
      memories: counts.captures || 0,
      lastActive: counts.lastActivity || p.last_used_at || null,
      connectedAt: p.created_at,
    });
  }

  // Real edges only — grouped, deduplicated, counted.
  const { results: edgeRows } = await env.DB.prepare(
    `SELECT project_id AS from_id, hit_project_id AS to_id, COUNT(*) AS n
     FROM project_activity
     WHERE hit_project_id IS NOT NULL
       AND project_id IN (SELECT id FROM project_tokens WHERE user_id = ? AND revoked_at IS NULL)
     GROUP BY project_id, hit_project_id`,
  )
    .bind(session.id)
    .all();

  const edges = edgeRows.map((e) => ({ from: e.from_id, to: e.to_id, count: e.n }));
  const totalMemories = projects.reduce((sum, p) => sum + p.memories, 0);

  // Real recent activity — what the "moving right now" feed replays as
  // pulses on load. Every row here really happened; nothing is decorative.
  const { results: recent } = await env.DB.prepare(
    `SELECT pa.action, pa.created_at, pt.id AS projectId, pt.name AS projectName
     FROM project_activity pa
     JOIN project_tokens pt ON pa.project_id = pt.id
     WHERE pt.user_id = ?
     ORDER BY pa.created_at DESC
     LIMIT 12`,
  )
    .bind(session.id)
    .all();

  return json(
    {
      core: { memories: totalMemories },
      projects,
      edges,
      recentActivity: recent,
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
