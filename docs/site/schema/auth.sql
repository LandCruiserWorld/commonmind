-- CommonMind accounts — Cloudflare D1 schema (separate from the CockroachDB
-- memory core in src/db/schema.sql). This is identity only: who's logged in.
-- Memory itself never lives here — every write still goes through Kousik's
-- CockroachDB API. A user's `id` here IS the owner_id attached to their
-- capture/recall calls once the memory API accepts tenant scoping.

CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,          -- becomes owner_id on the memory API
    email      TEXT UNIQUE NOT NULL,
    name       TEXT,
    company    TEXT,
    plan       TEXT DEFAULT 'premium_launch',  -- self_hosted | premium_launch | enterprise
    created_at TEXT DEFAULT (datetime('now'))
);

-- Magic-link tokens and sessions, same table, distinguished by `type`.
CREATE TABLE IF NOT EXISTS auth_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id),
    token       TEXT UNIQUE NOT NULL,
    type        TEXT NOT NULL,             -- 'magic_link' | 'session'
    redirect_to TEXT,                      -- safe same-origin path, magic_link only
    expires_at  TEXT NOT NULL,
    used_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
