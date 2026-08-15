/**
 * GET /api/memory/search?q=... — authenticated bridge to Kousik's CommonMind API.
 * Same shape as capture.js — see that file's header comment for the
 * owner_id caveat and the two required secrets.
 */

import { requireUser } from '../../_lib/session.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }
  if (!env.COMMONMIND_API_URL || !env.COMMONMIND_API_TOKEN) {
    console.error('search bridge misconfigured: missing COMMONMIND_API_URL/COMMONMIND_API_TOKEN');
    return json({ error: 'CommonMind backend not configured yet' }, 503);
  }

  const incoming = new URL(request.url);
  const query = incoming.searchParams.get('q') ?? incoming.searchParams.get('query') ?? '';
  if (!query) {
    return json({ error: 'missing q' }, 400);
  }
  const limit = incoming.searchParams.get('limit') ?? incoming.searchParams.get('top_k') ?? '3';

  const upstreamUrl = new URL(`${env.COMMONMIND_API_URL.replace(/\/$/, '')}/api/memory/search`);
  upstreamUrl.searchParams.set('q', query);
  upstreamUrl.searchParams.set('limit', limit);

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      Authorization: `Bearer ${env.COMMONMIND_API_TOKEN}`,
      'X-CommonMind-Owner': user.id,
    },
  });

  const body = await upstream.text();

  // Log real activity, and check whether the top hit was captured by a
  // *different* project — a real, provable cross-project connection, not
  // an inferred one. Only meaningful when a project (not the dashboard's
  // own session) is the one asking.
  if (user.projectId && upstream.ok) {
    let topHitId = null;
    try {
      topHitId = JSON.parse(body)?.results?.[0]?.id ?? null;
    } catch {}

    context.waitUntil(
      (async () => {
        let hitProjectId = null;
        let hitMemoryId = null;
        if (topHitId) {
          const origin = await env.DB.prepare(
            `SELECT project_id FROM project_activity
             WHERE action = 'capture' AND memory_id = ? AND project_id != ?
             LIMIT 1`,
          )
            .bind(topHitId, user.projectId)
            .first();
          if (origin) {
            hitProjectId = origin.project_id;
            hitMemoryId = topHitId;
          }
        }
        await env.DB.prepare(
          `INSERT INTO project_activity (id, project_id, action, hit_project_id, hit_memory_id)
           VALUES (?, ?, 'search', ?, ?)`,
        )
          .bind(crypto.randomUUID(), user.projectId, hitProjectId, hitMemoryId)
          .run();
      })().catch(() => {}),
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
