/**
 * Shared session lookup for anything under /api/memory/* — every route that
 * bridges to Kousik's CockroachDB API needs to know who's calling before it
 * will attach an owner_id and spend the shared bearer token.
 *
 * Two ways in, resolving to the same shape:
 *   - a browser session cookie (commonmind_session)
 *   - a project token in the Authorization header (cm_...) — how something
 *     that isn't a browser, like a game's Worker, authenticates as a user
 */

export async function requireUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearer) {
    // A bearer token is either a project key (cm_...) or, for convenience,
    // a session token passed the same way a browser fetch would.
    if (bearer.startsWith('cm_')) {
      const project = await env.DB.prepare(
        `SELECT u.id, u.email, u.plan, pt.id AS projectId, pt.name AS projectName
         FROM project_tokens pt
         JOIN users u ON pt.user_id = u.id
         WHERE pt.token = ? AND pt.revoked_at IS NULL`,
      )
        .bind(bearer)
        .first();
      if (project) {
        // Fire-and-forget — a slow last_used_at write shouldn't hold up the request.
        env.DB.prepare('UPDATE project_tokens SET last_used_at = datetime(\'now\') WHERE token = ?')
          .bind(bearer)
          .run()
          .catch(() => {});
      }
      return project || null;
    }
    return sessionUser(env, bearer);
  }

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/commonmind_session=([^;]+)/);
  if (!match) return null;
  return sessionUser(env, match[1]);
}

async function sessionUser(env, token) {
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
