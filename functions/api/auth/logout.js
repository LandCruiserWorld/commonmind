/**
 * Sign out
 * POST /api/auth/logout
 *
 * Burns the session server-side (not just clearing the cookie client-side —
 * a stolen cookie should stop working the moment the real user signs out).
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/commonmind_session=([^;]+)/);
  if (match) {
    await env.DB.prepare(
      'UPDATE auth_tokens SET used_at = datetime("now") WHERE token = ? AND type = "session"',
    )
      .bind(match[1])
      .run();
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'commonmind_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}
