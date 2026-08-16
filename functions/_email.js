/**
 * Email sender — Resend API.
 *
 * Ported from agent9-portal's functions/_email.js (same pattern, same
 * account). Sends the magic-link email that starts a CommonMind session.
 *
 * Required env var: RESEND_API_KEY (set via `wrangler pages secret put`,
 * scoped to the commonmind Pages project — a separate secret from
 * agent9-portal's, even though it can hold the same key value).
 *
 * Sender domain: reuses `updates.agent9.dev`, already verified in Resend for
 * agent9-portal — no new domain verification needed. Sending from the apex
 * `agent9.dev` would 403 (its MX/SPF belong to Zoho for inbound mail only).
 */

const DEFAULT_FROM_ADDR = 'commonmind@updates.agent9.dev';
const DEFAULT_FROM_NAME = 'CommonMind';
const DEFAULT_REPLY_TO = 'terry@agent9.dev';

export async function sendEmail(env, { to, subject, text, replyTo, fromName, fromAddr } = {}) {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY missing; skipping send');
    return { skipped: true, reason: 'no-api-key' };
  }
  if (!to || !subject) {
    console.warn('sendEmail: missing required fields', { to: !!to, subject: !!subject });
    return { skipped: true, reason: 'missing-fields' };
  }

  const fromHeader = `${fromName || DEFAULT_FROM_NAME} <${fromAddr || DEFAULT_FROM_ADDR}>`;
  const recipient = Array.isArray(to) ? to : [to];

  const body = {
    from: fromHeader,
    to: recipient,
    subject,
    text: text || '',
    reply_to: replyTo || DEFAULT_REPLY_TO,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Resend send failed', res.status, errText);
    return { skipped: false, ok: false, status: res.status, error: errText };
  }

  return { skipped: false, ok: true };
}
