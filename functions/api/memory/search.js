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
