/**
 * Secret redaction — applied to every capture before it leaves this
 * bridge, for every user, not just a hand-rolled script. Broad on purpose:
 * a false-positive redaction costs nothing; a missed real secret costs a
 * lot. If it looks like a credential, it doesn't get stored.
 */

const SECRET_PATTERNS = [
  /cm_[a-f0-9]{20,}/g, // a CommonMind project key itself
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-style
  /gh[pousr]_[a-zA-Z0-9]{20,}/g, // GitHub tokens
  /AKIA[0-9A-Z]{12,}/g, // AWS access key
  /AIza[0-9A-Za-z_-]{30,}/g, // Google API key
  /xox[baprs]-[0-9a-zA-Z-]{10,}/g, // Slack
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /[Bb]earer\s+[a-zA-Z0-9._-]{15,}/g,
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, // JWT
  /cfoat_[a-zA-Z0-9_-]{10,}/g, // Cloudflare OAuth token
  /r2_[a-zA-Z0-9]{20,}/g,
  /\b(api[_-]?key|token|secret|password|credential)s?\s*[:=]\s*['"]?[a-zA-Z0-9._-]{16,}/gi,
];

export function redactSecrets(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  return out;
}

/** Recursively redact every string value in an object/array in place, so a
 * capture body's shape (content, tags, whatever future fields) never needs
 * this function to know its schema. */
export function redactDeep(value) {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}
