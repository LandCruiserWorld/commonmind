/**
 * GET /api/memory/search?q=... — authenticated bridge to Kousik's CommonMind API.
 * Same shape as capture.js — see that file's header comment for the
 * owner_id caveat and the two required secrets.
 *
 * Isolation: Kousik's memory core only scopes by owner_id (the CommonMind
 * account), not by project — every project under one account shares a
 * single upstream pool. So isolation between projects is enforced HERE:
 * we ask upstream for a wider result set, then filter it down to memories
 * captured by this project, or by any project it's been explicitly linked
 * to (project_links — see /api/projects/[id]/links.js). Fails CLOSED:
 * unattributed results (captured before this tracking existed, or via some
 * path outside the project-token system) are hidden from every project,
 * not assumed safe. Only the dashboard's own session search — the account
 * owner looking at their whole account — skips this filter and sees
 * everything.
 *
 * The "connections" insight the dashboard shows is a separate thing: it's
 * detected against the FULL unfiltered upstream set, so a real similarity
 * across two unlinked projects still surfaces as a discovery, even though
 * its content never crosses into what either project actually gets back.
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
  const requestedLimit = Math.max(
    1,
    parseInt(incoming.searchParams.get('limit') ?? incoming.searchParams.get('top_k') ?? '3', 10) || 3,
  );
  // Ask upstream for more than we'll return, so the isolation filter below
  // still has enough in-scope candidates left to fill the real limit.
  const upstreamLimit = user.projectId ? Math.max(requestedLimit * 6, 25) : requestedLimit;

  const upstreamUrl = new URL(`${env.COMMONMIND_API_URL.replace(/\/$/, '')}/api/memory/search`);
  upstreamUrl.searchParams.set('q', query);
  upstreamUrl.searchParams.set('limit', String(upstreamLimit));

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      Authorization: `Bearer ${env.COMMONMIND_API_TOKEN}`,
      'X-CommonMind-Owner': user.id,
    },
  });

  const rawBody = await upstream.text();

  // No project to scope by (a dashboard session searching directly) or
  // upstream failed — nothing to filter, pass it straight through.
  if (!user.projectId || !upstream.ok) {
    return new Response(rawBody, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return new Response(rawBody, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
  }
  const results = Array.isArray(parsed?.results) ? parsed.results : null;
  if (!results) {
    return new Response(rawBody, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
  }

  // This project's allowed set: itself, plus anything it's explicitly linked to.
  const { results: linkRows } = await env.DB.prepare(
    `SELECT CASE WHEN project_a = ? THEN project_b ELSE project_a END AS id
     FROM project_links WHERE project_a = ? OR project_b = ?`,
  )
    .bind(user.projectId, user.projectId, user.projectId)
    .all();
  const allowed = new Set([user.projectId, ...linkRows.map((r) => r.id)]);

  // Who actually captured each candidate result, per our own activity log.
  const ids = results.map((r) => r.id).filter(Boolean);
  const attribution = new Map();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const { results: attrRows } = await env.DB.prepare(
      `SELECT memory_id, project_id FROM project_activity
       WHERE action = 'capture' AND memory_id IN (${placeholders})`,
    )
      .bind(...ids)
      .all();
    attrRows.forEach((r) => attribution.set(r.memory_id, r.project_id));
  }

  const filtered = results
    .filter((r) => {
      const owner = attribution.get(r.id);
      // Fail closed: a project only sees memories with a known, in-scope
      // owner. Untracked memories (captured before project attribution
      // existed, or via some path outside the project-token system) are
      // NOT assumed safe just because we can't prove otherwise — they stay
      // hidden from every project. Only the dashboard's own session search
      // (which skips this filter entirely, see above) sees the full,
      // unattributed account history.
      return owner ? allowed.has(owner) : false;
    })
    .slice(0, requestedLimit);

  // Cross-project "connection" detection runs on the FULL result set, not
  // just what we're returning — a real similarity to an unlinked project
  // is still worth surfacing as an insight, even though its content was
  // just filtered out of the actual answer above.
  context.waitUntil(
    (async () => {
      let hitProjectId = null;
      let hitMemoryId = null;
      const firstOutside = results.find((r) => {
        const owner = attribution.get(r.id);
        return owner && owner !== user.projectId;
      });
      if (firstOutside) {
        hitProjectId = attribution.get(firstOutside.id);
        hitMemoryId = firstOutside.id;
      }
      await env.DB.prepare(
        `INSERT INTO project_activity (id, project_id, action, hit_project_id, hit_memory_id)
         VALUES (?, ?, 'search', ?, ?)`,
      )
        .bind(crypto.randomUUID(), user.projectId, hitProjectId, hitMemoryId)
        .run();
    })().catch(() => {}),
  );

  const outBody = JSON.stringify({ ...parsed, results: filtered });
  return new Response(outBody, {
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
