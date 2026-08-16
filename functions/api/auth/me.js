/**
 * Get Current User
 * GET /api/auth/me
 *
 * Returns the signed-in user, reading the session from either the
 * commonmind_session cookie or a Bearer header. This is what the onboarding
 * wizard and dashboard call to know who's logged in — and its user.id is
 * the owner_id every downstream memory call gets scoped to.
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    let token = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      const cookie = request.headers.get('Cookie') || '';
      const match = cookie.match(/commonmind_session=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return json({ success: false, error: 'Not authenticated' }, 401, corsHeaders);
    }

    const session = await env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.company, u.plan, u.created_at
       FROM auth_tokens at
       JOIN users u ON at.user_id = u.id
       WHERE at.token = ? AND at.type = 'session' AND at.expires_at > datetime('now')`,
    )
      .bind(token)
      .first();

    if (!session) {
      return json({ success: false, error: 'Invalid session' }, 401, corsHeaders);
    }

    // session.id is the owner_id — the frontend hands this to the memory
    // bridge, never the shared bearer token itself.
    return json({ success: true, user: session }, 200, corsHeaders);
  } catch (error) {
    console.error('Auth check error:', error);
    return json({ success: false, error: 'Authentication check failed' }, 500, corsHeaders);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
