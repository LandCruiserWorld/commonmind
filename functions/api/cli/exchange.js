/**
 * POST /api/cli/exchange — the second half of `commonmind login`.
 *
 * No session, no cookie — this is called directly by the CLI process
 * (server-to-server, not from a browser) right after its local callback
 * server receives the code from the redirect. That's the whole point of
 * the code/token split: the browser hop only ever carries the opaque code,
 * so the real project token never touches a URL, browser history, or the
 * CLI's own localhost request log.
 *
 * Body: { code }
 * Single-use: burned the moment it's read, regardless of what the caller
 * does with the response. A 2-minute-old or already-used code is just as
 * invalid as one that never existed — same 400, no distinction given back,
 * so there's nothing for a guesser to learn from the response shape.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const code = typeof body?.code === 'string' ? body.code : '';
  if (!code) return json({ error: 'code is required' }, 400);

  const row = await env.DB.prepare(
    'SELECT code, token, expires_at, used_at FROM cli_auth_codes WHERE code = ?',
  )
    .bind(code)
    .first();

  const invalid = !row || row.used_at || new Date(row.expires_at) < new Date();
  if (invalid) {
    return json({ error: 'Invalid or expired code' }, 400);
  }

  // Burn it before responding — a code is good for exactly one exchange.
  await env.DB.prepare('UPDATE cli_auth_codes SET used_at = datetime("now") WHERE code = ?')
    .bind(code)
    .run();

  return json({ token: row.token, url: env.SITE_URL || 'https://commonmind.agent9.dev' }, 200);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
