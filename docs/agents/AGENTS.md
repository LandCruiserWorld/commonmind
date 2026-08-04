# AGENTS.md — CommonMind

Guidance for coding agents working in this repo.

## Where to get your work

**Take tasks from [`docs/CHECKLIST.md`](../CHECKLIST.md). Nowhere else.**

Several documents in this repo contain schedules. Only the checklist is current — `MASTER_DEVELOPER_DOC.md §4` and `STRATEGIC_PLAN.md §6` hold **superseded** day-by-day plans, retained for their reasoning. If a date or task anywhere contradicts the checklist, the checklist wins.

| Need | Read |
|---|---|
| What to do next | [`CHECKLIST.md`](../CHECKLIST.md) |
| Why the schedule is shaped this way | [`ROADMAP.md`](../ROADMAP.md) |
| Why a decision was made | [`BUILD_LOG.md`](../BUILD_LOG.md) |
| Schema and API contract | [`DEVELOPER_SPEC.md`](../DEVELOPER_SPEC.md) |
| The map of all of it | [`docs/README.md`](../README.md) |

**When you make a decision, write it into [`BUILD_LOG.md`](../BUILD_LOG.md)** — the decision *and* the reasoning. A decision with no recorded rationale gets relitigated a week later.

## Gotchas that have already cost us

- **CockroachDB is not Postgres.** It implements the pgwire protocol and most Postgres syntax, but it is not a fork. pgvector syntax (`USING hnsw`) does **not** run here — vector indexes are `CREATE VECTOR INDEX ... (embedding vector_cosine_ops)`, backed by C-SPANN. When a Postgres answer and a CockroachDB doc disagree, the doc wins.
- **Never use a sequential primary key.** `SERIAL`/`BIGSERIAL` funnels every insert into one range and creates a write hotspot. Use `UUID` or `unique_rowid()`.
- **Embeddings are `VECTOR(1024)`** — Titan Text Embeddings V2's native size. Any other dimension fails on insert.

## The one rule: memory is the product
Every change should keep the atomic-write invariant intact — a memory record and
its embedding are written **in one transaction**. Never split them.

## The 10 principles (from the bible)
These are immutable. New pull requests must not contradict them:
1. Memory is the product.
2. Memory must never go down.
3. Bridge, don't flood — signal, not spam.
4. Milestones, not noise.
5. Human decides, agent executes.
6. One memory engine, any product.
7. Brain health, not timecard.
8. The front door matters — one command.
9. Memory improves itself.
10. Kill the node, memory survives.

## Build & test
```bash
npm install
npm run check   # TypeScript type-check
npm test
```

## Tool constraints
- Storage must be **CockroachDB** (vector index, changefeed-capable).
- At least one **AWS** service must back the runtime (Bedrock / Lambda / S3 / SNS).
- No secrets in source. Env via `.env` (see `.env.example`).