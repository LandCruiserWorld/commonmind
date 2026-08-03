-- Cortex memory — CockroachDB schema (v1)
-- Every vector write carries its source row in the SAME transaction (atomic
-- memory invariant). Dream-weaver consolidation + changefeeds build on these.

-- Services: one per webhook/integration
CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         STRING NOT NULL,
  avatar_url    STRING,
  tap_url       STRING,
  webhook_token STRING NOT NULL UNIQUE,
  owner_id      STRING NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Devices: registered push targets
CREATE TABLE IF NOT EXISTS devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     STRING NOT NULL,
  platform     STRING NOT NULL,           -- 'inbox' | 'fcm' | 'apns'
  push_token   STRING NOT NULL,
  last_seen_at TIMESTAMPTZ,
  is_active    BOOL DEFAULT true
);

-- Notifications: transactional agent->human milestone events
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES services(id),
  device_id       UUID REFERENCES devices(id),
  title           STRING,
  body            STRING NOT NULL,
  image_url       STRING,
  url             STRING,
  idempotency_key STRING,
  status          STRING NOT NULL DEFAULT 'pending',
  delivered_count INT DEFAULT 0,
  response_type   STRING,
  response_status STRING,
  response_action STRING,
  response_text   STRING,
  correlation_id  STRING,
  callback_url    STRING,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (service_id, idempotency_key)
);

-- Live Activities: stateful cards (phone / web inbox)
CREATE TABLE IF NOT EXISTS live_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID NOT NULL REFERENCES services(id),
  device_id     UUID,
  key           STRING,
  title         STRING NOT NULL,
  status        STRING NOT NULL,
  detail        STRING,
  progress      FLOAT,
  symbol        STRING,
  accent_color  STRING,
  style         STRING DEFAULT 'standard',
  sequence      INT DEFAULT 0,
  state         JSONB,
  expires_at    TIMESTAMPTZ,
  stale_at      TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Memory records: the things agents + humans remember
CREATE TABLE IF NOT EXISTS memory_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type STRING NOT NULL,            -- 'notification' | 'incident' | 'runbook' | 'decision'
  content     STRING NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Embeddings: VECTOR(768) with HNSW index
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type STRING NOT NULL,
  entity_id   UUID NOT NULL,
  embedding   VECTOR(768) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_embeddings_hnsw
  ON memory_embeddings USING hnsw (embedding vector_cosine_ops);

-- Consolidated memories written by dream-weaver agents
CREATE TABLE IF NOT EXISTS memory_consolidations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind             STRING NOT NULL,       -- 'pattern' | 'surprise' | 'digest' | 'insight'
  summary          STRING NOT NULL,
  source_entity_ids UUID[],
  surprise_score   FLOAT,
  frequency        INT DEFAULT 0,
  recency          TIMESTAMPTZ,
  embedding        VECTOR(768) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_consolidations_hnsw
  ON memory_consolidations USING hnsw (embedding vector_cosine_ops);

-- Event log / audit: changefeed key (CDC -> SNS -> push pipeline)
CREATE TABLE IF NOT EXISTS memory_events (
  seq          BIGSERIAL PRIMARY KEY,
  entity_type  STRING NOT NULL,
  entity_id    UUID NOT NULL,
  action       STRING NOT NULL,
  payload      JSONB,
  agent        STRING,
  created_at   TIMESTAMPTZ DEFAULT now()
);