# Developer Spec — CommonMind

**Project:** CockroachDB × AWS Hackathon — Build with Agentic Memory
**Working title:** "CommonMind" — name settled Aug 4, 2026 (was “Cortex”; renamed for collisions)
**Deadline:** Aug 18, 2026 @ 5:00 PM EDT
**Stack preference:** TypeScript/Node (fast to ship); Rust optional for perf story
**Status:** v0 spec — concept locked, implementation pending

---

## 1. Executive Summary

We are building a **webhook → phone notification + agent approval platform** (an approval layer for the agentic era) where the **entire state machine lives in CockroachDB** as the globally-replicated, transactional, always-on memory layer.

The core thesis that wins the hackathon:

> **An agent whose memory goes offline doesn't degrade gracefully — it stops. We make the memory layer *the product*: every notification, approval, and Live Activity is a transaction in CockroachDB. Memory isn't an afterthought; it's the substrate agents think, act, and remember on.**

What makes it novel vs. a plain webhook-to-push tool:
1. **Memory is the source of truth** — CDC changefeeds off the DB drive the push pipeline; the DB is both state store *and* event source.
2. **Self-improving consolidation** — background "dream-weaver" agents (Titans/Miras-style surprise scoring) reorganize memory so agents get measurably better over time.
3. **Resilience as the demo** — kill the CockroachDB node live; activities survive and keep updating. Multi-region replication = zero data loss.
4. **All 4 CockroachDB tools + AWS used deeply** — not ticked for compliance.

---

## 2. Requirements Compliance Checklist

The rules require **≥2 CockroachDB tools** and **≥1 AWS service**. We commit to all four + multiple AWS.

| CockroachDB Tool | How we use it |
|---|---|
| **Distributed Vector Indexing** | Semantic recall: search notification/incident history; surprise-scoring for dream-weavers; multi-factor retrieval |
| **Managed MCP Server** | Agents (and humans via our demo UI) introspect CommonMind read-only, safely, with audit logging |
| **ccloud CLI (agent-ready)** | A "memory ops agent" provisions clusters, takes backups, configures RBAC autonomously — agents self-manage infrastructure |
| **Agent Skills Repo** | We package our own agent skills (e.g. `commonmind-query`, `commonmind-approve`, `commonmind-consolidate`) following the repo's machine-executable format |
| **Changefeeds (CDC)** | (bonus, not on required list) — the transactional event stream that drives SNS → push. This is our differentiator |

| AWS Service | How we use it |
|---|---|
| **Amazon SNS** | Fanout of CDC events → push pipeline, retries, DLQ |
| **AWS Lambda** | Push fanout worker, CDC → SNS bridge, dream-weaver consolidation workers, API handlers |
| **Amazon S3** | Avatars/images, artifact storage (runbooks, incident attachments) |
| **Amazon Bedrock** | LLM reasoning (write rich push copy), embeddings for vector indexing |
| **Amazon ECS/EKS** (optional) | Persistent API + Activity API if Lambda cold starts hurt the live demo |

### 2.3.1 Hosting model — serverless on AWS (locked)

CommonMind's paid **Premium (hosted)** tier runs entirely on **serverless AWS**, satisfying the hackathon's "deployed on AWS" requirement with no VMs to manage:

- **AWS Lambda** — API handlers, CDC → SNS bridge, dream-weaver consolidation workers, push fanout. Scales to zero, billed per invocation.
- **Amazon Bedrock** — serverless model inference for embeddings/LLM.
- **AWS SNS + S3** — serverless push pipeline and artifact storage.
- **CockroachDB Cloud Basic (serverless)** — the persistent memory layer, hosted on **AWS regions**, RU-metered and scales to zero.

**Cost posture:** this is the **multi-tenant serverless** model — one shared Basic footing serves many tenants; COGS ≈ $5–10/mo per tenant, so hosting is profitable from **2+ employees/tenant** at $20/employee (~80–90% gross margin on infra). The floor leans on **self-serve onboarding & capped support** so a solo tenant ($20/mo) stays ≈ break-even to thin-profit — fine for adoption, not a profit center. **Avoid** dedicated per-tenant Standard clusters (~$120–130/mo) which undercut the price point.

Pricing tiers (locked): **Self-hosted $0 forever → Premium $20/employee/mo (2+ employees; solo founders auto-approved at the same rate) → Enterprise custom.**

---

## 3. Architecture

### 3.1 Top-level flow

```
                 ┌────────────────────────────────────────────────────────┐
 webhook / commonmind │ API (Lambda/ECS)  →  write/read                      │
 ─────────────────>│                     │                                 │
                 │        CockroachDB (THE MEMORY LAYER)                │
                 │   - services, webhooks, events                         │
                 │   - notifications/approvals state machine              │
                 │   - Live Activities (persistent, resumable)            │
                 │   - vector index → "search my push history"            │
                 │   - memory consolidation tables                        │
                 └─────────┬───────────────────────────────────────────────┘
                 Changefeed │ (every event streams out of the DB)
                  ┌─────────▼──────────┐
                  │  SNS → SQS          │  fanout, retries, DLQ
                  └─────────┬──────────┘
                  ┌─────────▼──────────┐
                  │  Lambda fanout     │
                  └─────────┬──────────┘
                  ┌─────────▼───────────────────┐
                  │ PushProvider (pluggable)     │
                  │  - Inbox/PWA Web Push        │
                  │  - FCM (Android)             │
                  │  - APNs/Expo (iOS, stretch)  │
                  └──────────────────────────────┘
```

### 3.2 The agent loop (think → act → remember)

```
think (Bedrock) → act (Lambda/ECS) → remember (atomic write: row + embedding)
                    ↑                                  │
                    │          retrieve similar (vector search)
                    │                                  ▼
            consolidate (dream-weavers, background)
```

- Agents coordinate by **writing and reading the shared memory**, not by messaging each other. The transactional memory log doubles as the coordination bus.
- Every memory write is **atomic**: the operational row + its embedding are inserted in a single CockroachDB transaction. No consistency gap between "what happened" and "what's retrievable."

### 3.3 Push pipeline detail

```
agent writes to CommonMind (atomic row+embedding)
  → CockroachDB changefeed (CDC)
  → Amazon SNS (topic per service/account)
  → SQS (queue) + DLQ (dead-letter)
  → Lambda fanout worker
  → PushProvider
     - inbox-web: insert into notifications table → served by web app (real-time via subscription/changelog)
     - FCM: Android native notifications (sideloaded APK)
     - APNs/Expo: iOS lock screen + Live Activities (TestFlight, stretch)
```

**Why the memory write IS the notification:** the transaction that records "fought incident #47, deployed runbook 12" is both the durable memory *and* the payload that triggers the push. Judges hear this sentence and the architecture clicks.

---

## 4. Data Model (CockroachDB Schema)

All tables below in a single database. Vector columns use the CockroachDB `VECTOR(...)` type indexed by **C-SPANN**, CockroachDB's distributed vector index (a hierarchical K-means partition tree derived from Microsoft's SPANN). CockroachDB does **not** implement HNSW — pgvector's `USING hnsw (...)` syntax will not run here.

### 4.1 Core

```sql
-- Services: one per webhook/integration
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         STRING NOT NULL,
  avatar_url    STRING,
  tap_url       STRING,
  webhook_token STRING NOT NULL UNIQUE,   -- secret credential
  owner_id      STRING NOT NULL,          -- account/team
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Devices: registered push targets
CREATE TABLE devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     STRING NOT NULL,
  platform     STRING NOT NULL,           -- 'inbox' | 'fcm' | 'apns'
  push_token   STRING NOT NULL,
  last_seen_at TIMESTAMPTZ,
  is_active    BOOL DEFAULT true
);

-- Notifications (one-shot pushes) — THE core transactional event
CREATE TABLE notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id     UUID NOT NULL REFERENCES services(id),
  device_id      UUID REFERENCES devices(id),       -- null = fanout
  title          STRING,
  body           STRING NOT NULL,
  image_url      STRING,
  url            STRING,
  idempotency_key STRING,
  status         STRING NOT NULL DEFAULT 'pending', -- pending|delivered|failed|expired
  delivered_count INT DEFAULT 0,
  response_type  STRING,                  -- approval|yes_no|text (nullable)
  response_status STRING,                 -- pending|approved|denied|yes|no|replied|expired|canceled
  response_action STRING,
  response_text  STRING,
  correlation_id STRING,
  callback_url   STRING,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (service_id, idempotency_key)
);

-- Live Activities (stateful cards on Lock Screen / Dynamic Island)
CREATE TABLE live_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID NOT NULL REFERENCES services(id),
  device_id     UUID,
  key           STRING,                   -- caller alias
  title         STRING NOT NULL,
  status        STRING NOT NULL,
  detail        STRING,
  progress      FLOAT,
  symbol        STRING,
  accent_color  STRING,
  style         STRING DEFAULT 'standard',
  sequence      INT DEFAULT 0,            -- optimistic concurrency (ifSequence)
  state         JSONB,                    -- full current state
  expires_at    TIMESTAMPTZ,
  stale_at      TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Memory / vector layer

**Canonical capture table (decided Aug 4).** A captured memory is a `memory_records` row. `notifications` is the *subset* of memory that crossed the alert threshold and needs a human — not the capture table itself. Most memory is silent (see the alert regime), so modelling every memory as a notification would leave the majority of rows carrying null `device_id`, `status`, `delivered_count`, `response_*`, `callback_url` and `expires_at`. An architecture decision should not have a delivery status.

"The memory write *is* the notification" still holds: the memory commits, the changefeed fires, and a `notifications` row is created for the events that need a person.

```sql
-- The captured memory itself — what happened
CREATE TABLE memory_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type STRING NOT NULL,            -- 'notification' | 'incident' | 'runbook' | 'decision'
  content     STRING NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Embeddings of captured memory for semantic recall
CREATE TABLE memory_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type STRING NOT NULL,            -- 'notification' | 'incident' | 'runbook' | 'decision'
  entity_id   UUID NOT NULL,
  embedding   VECTOR(1024) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON memory_embeddings (entity_id);   -- join key for recall
CREATE VECTOR INDEX ON memory_embeddings (embedding vector_cosine_ops);

-- Consolidated memories written by dream-weaver agents
CREATE TABLE memory_consolidations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           STRING NOT NULL,         -- 'pattern' | 'surprise' | 'digest' | 'insight'
  summary        STRING NOT NULL,
  source_entity_ids UUID[],
  surprise_score FLOAT,
  frequency      INT DEFAULT 0,
  recency        TIMESTAMPTZ,
  embedding      VECTOR(1024) NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE VECTOR INDEX ON memory_consolidations (embedding vector_cosine_ops);

-- Event log / audit (every write, transactionally)
CREATE TABLE memory_events (
  seq          INT PRIMARY KEY DEFAULT unique_rowid(),  -- changefeed key; NOT
                                           -- BIGSERIAL: sequential PKs hotspot a
                                           -- single range on our hottest write path
  entity_type  STRING NOT NULL,
  entity_id    UUID NOT NULL,
  action       STRING NOT NULL,           -- 'created' | 'updated' | 'approved' | 'expired' ...
  payload      JSONB,
  agent        STRING,                    -- which agent/actor
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

> **Atomic-write invariant:** writing a memory *and* its embedding happens inside one transaction (`INSERT memory_records ...; INSERT memory_embeddings ...`). The dream-weavers and agents only ever observe consistent memory. A `notifications` row is created downstream, for the subset of memory that crosses the alert threshold.

---

## 5. API Contract (v1)

Auth: `webhookToken` in URL path OR bearer token. Responses are JSON with `{ ok: bool, ... }`.

### 5.1 Notification API

| Route | Method | Purpose |
|---|---|---|
| `/hooks/:token` | POST | Send one-shot push. Required: `body`. Optional: `title`, `imageUrl`, `url`, `deviceIds`, `idempotencyKey` (header), `response` |
| `/hooks/:token/events/:eventId` | GET | Read interactive response state |
| `/hooks/:token/events/:eventId/cancel` | POST | Withdraw pending prompt |

Request payload:
```json
{
  "body": "Production deployed successfully.",
  "title": "GitHub",
  "imageUrl": "https://github.com/github.png",
  "url": "https://github.com/acme/app/actions",
  "response": {
    "type": "approval",
    "expiresInSeconds": 900,
    "correlationId": "deploy-184",
    "callback": { "url": "https://ci.example.com/commonmind-response", "token": "private-token" }
  }
}
```

Idempotency semantics (scoped per service):
- Same key + same payload → return original event (`idempotent: true`)
- Same key + different payload → `409 Conflict`
- Same key in-flight → `202 Accepted`

### 5.2 Activity API (Live Activities)

| Route | Method | Purpose |
|---|---|---|
| `/hooks/:token/live-activities` | POST | Start activity. Required: `title`, `status`. Optional: `progress`, `detail`, `symbol`, `accentColor`, `style`, `key`, `replace`, `deviceIds` |
| `/hooks/:token/live-activities/:id` | GET | Read current state |
| `/hooks/:token/live-activities/:id` | PATCH | Partial update (merge). Optional `ifSequence` for optimistic concurrency |
| `/hooks/:token/live-activities/:id/end` | POST | Settle/dismiss. Optional `dismissAfterSeconds` |

Activity lifecycle: `active` → updates increment `sequence` → `expired` (after `expiresInSeconds`) or `ended`. One activity per device; `replace: true` displaces blockers.

### 5.3 Agent / Memory API (our differentiation)

| Route | Method | Purpose |
|---|---|---|
| `/api/memory/search?q=...` | GET | Semantic search over push/incident history (vector recall) |
| `/api/memory/patterns` | GET | Learned patterns from dream-weavers |
| `/api/memory/analytics` | GET | Access analytics (recall rate, top memories) |
| `/api/memory/surprise-analysis` | GET | Surprise distribution over memory corpus |
| `/api/memory/similar/:id` | GET | Find similar memories |
| `/api/consolidation/weekly` | GET | Weekly digest of what agents did |

A five-phase intelligence system running on CockroachDB.

### 5.4 CommonMind MCP server (the universal adapter — no per-app plugins)

Because Claude Code, Cursor, Codex CLI, opencode, Copilot, and future agents all speak the **MCP protocol natively**, we ship **one** CommonMind MCP server (backed by CockroachDB's Managed MCP Server) instead of per-app plugins. `commonmind connect <cli>` either registers CommonMind as the tool provider or drops native hooks where supported (Claude Code, opencode). The MCP tool surface is deliberately small and consistent:

| Tool | Direction | Behavior |
|---|---|---|
| `memory.capture` | W | Record a decision/gotcha/result atomically (row + embedding, one txn) |
| `memory.recall` | R | Semantic vector recall over the corpus, with source + thread + confidence |
| `memory.ask` | R→W | Hand control to a human; opens a thread whose approval state machine lives in CockroachDB |
| `memory.approve` | W | Human decision on an open thread (approve / deny / redirect); resumes agent via CDC |
| `memory.note` | W | Contribute a public or private note to the company brain (public = grows index, private = contributor only) |

Per-app onboarding is just a thin `docs/agents/` file (`AGENTS.md` / `SKILL.md`) telling the agent it has this MCP tool surface — no plugin for each CLI.

---

## 6. Components

### 6.1 API service (Node/TS + Fastify, or ECS)
- REST endpoints above; validates payloads; writes transactions to CockroachDB.
- Pg pool (`pg` npm) with connection string from env.
- Idempotency handling in DB (unique constraint on `(service_id, idempotency_key)`).

### 6.2 CDC bridge (Lambda)
- Subscribes to CockroachDB changefeed on `memory_events`.
- Batches events → publishes to SNS topic.

### 6.3 Fanout worker (Lambda)
- Consumes SQS; resolves target devices; calls the correct `PushProvider`.
- Retries w/ backoff; failed deliveries → DLQ + marks `notifications.status = 'failed'`.

### 6.4 PushProvider interface
```ts
interface PushProvider {
  send(notification: NotificationRecord, device: Device): Promise<DeliveryResult>;
  startActivity(activity: ActivityRecord, device: Device): Promise<DeliveryResult>;
  updateActivity(activity: ActivityRecord, device: Device): Promise<DeliveryResult>;
  endActivity(activity: ActivityRecord, device: Device): Promise<DeliveryResult>;
}
```
Implementations:
- `InboxProvider` — writes to the web app's notification inbox; enables live demo with zero app-store/cert cost. **MVP default.**
- `FcmProvider` — Android native via FCM (sideloaded APK).
- `ExpoApnsProvider` — iOS lock screen + Live Activities (stretch; TestFlight).

### 6.5 Dream-weaver consolidation workers (Lambda, cron)
- Periodically: embed new memory events → compute surprise vs. corpus → extract patterns → write `memory_consolidations` atomically.
- Built on Titans/Miras-style surprise scoring + multi-factor retrieval.

### 6.6 ccloud self-management agent
- A "memory ops agent" invoked via ccloud CLI (JSON-out mode) to provision/destroy the cluster, take backups, set RBAC. Demonstrates the agent-ready control plane in the video.

### 6.7 CommonMind MCP server (universal adapter)
- Runs `commonmind serve-mcp` (stdio for local CLIs + HTTP/SSE for remote); backed by CockroachDB Managed MCP Server.
- Implements the small tool surface in **5.4**: `memory.capture`, `memory.recall`, `memory.ask`, `memory.approve`, `memory.note` — all are thin wrappers over the API in **5.3** with the same atomic-write + vector path.
- `memory.capture`/`memory.note` write atomically (row + embedding, `ON CONFLICT`) — no partial memory.
- `memory.ask`/`memory.approve` reuse the approval state machine + CDC so a decision survives an agent restart.
- `commonmind connect <cli>` registers CommonMind as the MCP provider, or drops native hooks (Claude Code, opencode); per-app behavior documented in `docs/agents/*.md`.

---

## 7. Benchmark Data (already measured)

Local single-node CockroachDB v25.2.3, parallel inserts, `ON CONFLICT DO UPDATE`:
- **Node (pg pool):** ~2,334 ops/s (100k), ~1,151 ops/s (20k)
- **Rust (tokio-postgres + deadpool):** ~1,712 ops/s (100k), ~1,273 ops/s (20k)

**Conclusion (critical design decision):** both languages bottleneck on the same single-node CockroachDB write path. The app language is NOT the throughput limit — the DB is. Therefore:
- **Language choice = developer velocity, not performance.** We ship TypeScript.
- **Rust optional** only if we later want the Lambda cold-start/binary-size story.
- To demonstrate "agents writing at scale," run the same fixture against a real **multi-node / CockroachDB Cloud GLOBAL cluster** — that's where write ceiling and connection-pool efficiency actually matter. (Benchmark fixture saved in `bench/`.)

---

## 8. Demo / Video Script (<3 min, YouTube)

1. **Hook (0:00–0:20):** Terminal: `commonmind notify ask "Deploy to production?" --approval` — an agent (Claude Code / Codex) requests approval.
2. **Phone (0:20–0:50):** Live Activity card appears with Approve/Deny + progress bar pinned in the Dynamic Island. Show it drive Building → Testing → Shipped as events flow through CockroachDB (progress bar moves on each CDC event).
3. **Memory (0:50–1:30):** `GET /api/memory/search?q=deploy 184` → agent recalls the exact prior deploy, its approval decision, and its outcome. Show the atomic memory (row + embedding in one txn). Dream-weaver insight: "deploys that X-rayed at 22:00 succeeded 40% less often" — memory learned a pattern.
4. **Resilience (1:30–2:20):** **Kill the CockroachDB node live.** Show the activity card survives; node restarts; agents resume with complete memory. "An agent whose memory goes offline doesn't degrade gracefully — ours never loses it."
5. **Self-ops (2:20–2:50):** Memory ops agent runs ccloud CLI: takes a backup, shows RBAC, introspects audit logs.
6. **Close (2:50–3:00):** "Memory is the product. Built on CockroachDB + AWS."

**Demo devices:** use inbox/PWA live; screenshot a native phone for polish. TestFlight-native iOS is a stretch goal, not a blocker.

---

## 9. Delivery Plan (2 weeks to Aug 18)

### Week 1 — Core loop
- [ ] CockroachDB Cloud cluster provisioned (GLOBAL multi-region), schema migrated
- [ ] API service: notifications + approvals + idempotency (Node/TS)
- [ ] InboxProvider web app (MVP push surface) + real-time refresh
- [ ] CDC changefeed → SNS → SQS → Lambda fanout → InboxProvider E2E

### Week 2 — Differentiation + polish
- [ ] Vector embeddings (Bedrock) + `memory_embeddings` + `/api/memory/search`
- [ ] Dream-weaver consolidation workers (surprise scoring + patterns)
- [ ] Live Activities state machine + Activity API
- [ ] ccloud self-management agent
- [ ] CommonMind MCP server (capture / recall / ask / approve / note) + `docs/agents/` guide files
- [ ] Benchmark fixture vs. multi-node cluster; record numbers for README
- [ ] 3-min video, architecture diagram, README, Apache-2.0 license, public repo, demo URL

### Stretch (if time)
- [ ] FCM Android receiver (sideload APK)
- [ ] Expo/APNs iOS + TestFlight
- [ ] `commonmind`-style CLI with approval `--wait` semantics

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Live Activities APNs setup is fiddly (iOS 16.1+, entitlement, push-to-start) | High | Inbox/PWA is MVP push surface; native is stretch. Screenshot native for video |
| CockroachDB Cloud free tier limits | Medium | Benchmark on local node; demo on Cloud with modest volumes |
| Changefeed latency/overhead | Medium | Stream via `memory_events` log table, batch in Lambda |
| 3-min video overruns | Medium | Storyboard; trim resilience segment if needed |
| MCP + ccloud deep integration eats time | Low | Both are scripted show-pieces; wire last |
| Judge bias vs. "another notification tool" | High | Lead with memory/self-improvement/resilience demo, not the webhook |

---

## 11. Open Decisions

1. **Push surface priority:** inbox/PWA only, or push FCM+APNs harder? (Recommend: inbox/PWA + one native screenshot.)
2. **Language:** TypeScript confirmed; Rust only if we want cold-start numbers in the README.
3. **Hosting:** Lambda-first for cost/ops; ECS only if the live demo needs consistent sub-50ms API.
4. **Scope of dream-weavers:** full five-phase layer, or a lean two-phase (surprise + patterns) to guarantee ship?
5. **Name:** "CommonMind" / "the Dream-Weaver agent" — confirm final.

---

*Next step: scaffold the monorepo (API, CDC bridge, fanout worker, inbox-web, dream-weaver, bench) and implement the Week-1 core loop.*
