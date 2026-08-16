/**
 * Verify Magic Link Token
 * GET /api/auth/verify?token=xxx
 *
 * Validates a magic-link token, burns it, issues a 30-day session cookie,
 * and redirects into the app. Ported from agent9-portal's
 * functions/api/auth/verify.js.
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return json({ success: false, error: 'Token is required' }, 400);
  }

  try {
    const authToken = await env.DB.prepare(
      `SELECT at.*, u.email
       FROM auth_tokens at
       JOIN users u ON at.user_id = u.id
       WHERE at.token = ? AND at.type = 'magic_link' AND at.used_at IS NULL`,
    )
      .bind(token)
      .first();

    if (!authToken) {
      return json({ success: false, error: 'Invalid or expired link' }, 401);
    }
    if (new Date(authToken.expires_at) < new Date()) {
      return json({ success: false, error: 'Link has expired' }, 401);
    }

    // Burn the magic link — one use only.
    await env.DB.prepare('UPDATE auth_tokens SET used_at = datetime("now") WHERE token = ?')
      .bind(token)
      .run();

    const sessionToken = crypto.randomUUID();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      'INSERT INTO auth_tokens (id, user_id, token, type, expires_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), authToken.user_id, sessionToken, 'session', sessionExpires)
      .run();

    const siteUrl = env.SITE_URL || 'https://commonmind.agent9.dev';
    const isSecure = siteUrl.startsWith('https');

    let redirectTarget = '/dashboard/';
    const stored = authToken.redirect_to;
    if (
      typeof stored === 'string' &&
      stored.startsWith('/') &&
      !stored.startsWith('//') &&
      !/^\/+[a-z][a-z0-9+.-]*:/i.test(stored)
    ) {
      redirectTarget = stored;
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTarget,
        'Set-Cookie': `commonmind_session=${sessionToken}; Path=/; HttpOnly; ${
          isSecure ? 'Secure; ' : ''
        }SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    return json({ success: false, error: 'Verification failed' }, 500);
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
