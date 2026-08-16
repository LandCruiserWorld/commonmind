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

-- Project keys: how something that isn't a browser (a game server, a Worker,
-- a CLI) authenticates as a given account. Resolves to the same owner_id a
-- session cookie would, so the memory bridge treats both identically.
CREATE TABLE IF NOT EXISTS project_tokens (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id),
    name         TEXT NOT NULL,             -- e.g. "Ocean Dreams"
    token        TEXT UNIQUE NOT NULL,      -- shown once at creation, never again
    created_at   TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_tokens_token ON project_tokens(token);
CREATE INDEX IF NOT EXISTS idx_project_tokens_user ON project_tokens(user_id);

-- Every capture/search made through a project key, logged here — this is
-- what makes the network map real instead of decorative. memory_id is
-- CockroachDB's id for a capture (nullable for searches, which don't create
-- one); hit_memory_id is filled in when a search returns a memory that was
-- captured under a *different* project's key — a real, provable cross-
-- project connection, not an inferred or fabricated one.
CREATE TABLE IF NOT EXISTS project_activity (
    id             TEXT PRIMARY KEY,
    project_id     TEXT NOT NULL REFERENCES project_tokens(id),
    action         TEXT NOT NULL,        -- 'capture' | 'search'
    memory_id      TEXT,                 -- set on capture
    hit_project_id TEXT,                 -- set on search, if the top hit came from a different project
    hit_memory_id  TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project ON project_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_memory ON project_activity(memory_id);

-- Explicit, user-controlled sharing between two of their own projects.
-- Isolated is the default: without a row here, a project's search only
-- ever sees memories captured under its own key. A link makes recall
-- mutual between the pair — the user opts in per project, not a global
-- switch. (project_a, project_b) is stored with the lower id first so a
-- pair only ever has one row regardless of which side created the link.
CREATE TABLE IF NOT EXISTS project_links (
    id         TEXT PRIMARY KEY,
    project_a  TEXT NOT NULL REFERENCES project_tokens(id),
    project_b  TEXT NOT NULL REFERENCES project_tokens(id),
    user_id    TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(project_a, project_b)
);

CREATE INDEX IF NOT EXISTS idx_project_links_a ON project_links(project_a);
CREATE INDEX IF NOT EXISTS idx_project_links_b ON project_links(project_b);
