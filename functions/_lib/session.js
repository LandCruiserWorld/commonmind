/**
 * Shared session lookup for anything under /api/memory/* — every route that
 * bridges to Kousik's CockroachDB API needs to know who's calling before it
 * will attach an owner_id and spend the shared bearer token.
 */

export async function requireUser(request, env) {
  let token = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/commonmind_session=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;

  const session = await env.DB.prepare(
    `SELECT u.id, u.email, u.plan
     FROM auth_tokens at
     JOIN users u ON at.user_id = u.id
     WHERE at.token = ? AND at.type = 'session' AND at.expires_at > datetime('now')`,
  )
    .bind(token)
    .first();

  return session || null;
}
