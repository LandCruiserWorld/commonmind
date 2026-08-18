/**
 * DELETE /api/memory/:id — remove a memory from this user's view.
 *
 * The underlying memory core doesn't expose a delete operation yet (a real
 * gap on the upstream side, not something this bridge can add on its own).
 * So this does the part that's actually ours to guarantee: the memory is
 * hidden, instantly and permanently, from every search and every project
 * view for this user — functionally deleted from the product's point of
 * view. We still attempt the real upstream delete too (silently, best
 * effort) so this upgrades to a true purge the moment the core supports
 * one, with zero client-side changes needed.
 *
 * Session-only: the dashboard is the primary use case (cleaning up a
 * mistaken or junk capture), not a programmatic project-token operation.
 */

import { requireUser } from '../../_lib/session.js';

export async function onRequestDelete(context) {
  const { request, env, params } = context;

  if (request.headers.get('Authorization')) {
    return json({ error: 'Not authenticated' }, 401);
  }
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: 'Not authenticated' }, 401);
  }
  const id = params.id;
  if (!id) {
    return json({ error: 'missing id' }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO hidden_memories (id, user_id, memory_id) VALUES (?, ?, ?)
     ON CONFLICT(user_id, memory_id) DO NOTHING`,
  )
    .bind(crypto.randomUUID(), user.id, id)
    .run();

  if (env.COMMONMIND_API_URL && env.COMMONMIND_API_TOKEN) {
    context.waitUntil(
      fetch(`${env.COMMONMIND_API_URL.replace(/\/$/, '')}/api/memory/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${env.COMMONMIND_API_TOKEN}`,
          'X-CommonMind-Owner': user.id,
        },
      }).catch(() => {}),
    );
  }

  return json({ ok: true, hidden: true }, 200);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
