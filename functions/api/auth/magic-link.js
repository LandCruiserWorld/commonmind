/**
 * Magic Link Authentication
 * POST /api/auth/magic-link
 *
 * Sends a passwordless sign-in link. Creates the user row on first sign-in —
 * there's no separate "sign up" step. Ported from agent9-portal's
 * functions/api/auth/magic-link.js, same pattern, adapted for CommonMind's
 * users/auth_tokens shape (see docs/site/schema/auth.sql).
 */

import { sendEmail } from '../../_email.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { email, next } = await request.json();

    // Same-origin path validation — must start with a single '/', no
    // protocol, no host. Anything else is dropped silently (we still send
    // the link, we just won't redirect to it).
    const safeNext =
      typeof next === 'string' &&
      next.startsWith('/') &&
      !next.startsWith('//') &&
      !/^\/+[a-z][a-z0-9+.-]*:/i.test(next)
        ? next
        : null;

    if (!email) {
      return json({ success: false, error: 'Email is required' }, 400, corsHeaders);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json({ success: false, error: 'Invalid email address' }, 400, corsHeaders);
    }

    const normalizedEmail = email.toLowerCase();

    let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(normalizedEmail)
      .first();

    if (!user) {
      const userId = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO users (id, email, name) VALUES (?, ?, ?)')
        .bind(userId, normalizedEmail, normalizedEmail.split('@')[0])
        .run();
      user = { id: userId, email: normalizedEmail };
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    await env.DB.prepare(
      'INSERT INTO auth_tokens (id, user_id, token, type, expires_at, redirect_to) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(crypto.randomUUID(), user.id, token, 'magic_link', expiresAt, safeNext)
      .run();

    const siteUrl = env.SITE_URL || 'https://commonmind.agent9.dev';
    const magicLink = `${siteUrl}/api/auth/verify?token=${token}`;

    const emailBody = `
Sign in to CommonMind

Click the link below — it signs you in and takes you straight to your dashboard:

${magicLink}

This link expires in 15 minutes and works once.

If you didn't request this, you can safely ignore this email.

CommonMind
https://commonmind.agent9.dev
    `.trim();

    await sendEmail(env, {
      to: normalizedEmail,
      subject: 'Sign in to CommonMind',
      text: emailBody,
    });

    return json({ success: true, message: 'Magic link sent' }, 200, corsHeaders);
  } catch (error) {
    console.error('Magic link error:', error);
    return json({ success: false, error: 'Failed to send magic link' }, 500, corsHeaders);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
