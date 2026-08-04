# Start here

Welcome. There's a lot of planning in this repo — that's deliberate, the thinking is done so the building can be fast. But you don't need most of it today.

**Read three things, run five commands, do one task.** Everything else can wait until you need it.

---

## 1. Understand it in five minutes

Read the [README](./README.md) down to the end of "Why CockroachDB." Stop there.

The one-paragraph version: **agents forget everything when a session ends, and the people who needed to know never find out what the agents did.** CommonMind is one memory both sides write to and read from, with CockroachDB as the system of record — so a human's decision becomes a memory the agent recalls next time. We're building it for the [CockroachDB × AWS hackathon](https://cockroachdb-ai.devpost.com/), due **Aug 18, 2026, 5:00 PM EDT**.

---

## 2. Know where the work comes from

**[`docs/CHECKLIST.md`](./docs/CHECKLIST.md) is the only place to take tasks from.**

Several documents here contain schedules. Two of them are deliberately out of date and marked SUPERSEDED — they're kept for their reasoning, not their dates. If anything contradicts the checklist, **the checklist wins**.

Read [`docs/README.md`](./docs/README.md) once — it's a one-page map of what every other document owns. Then ignore the rest until you have a specific question:

| Question | Where |
|---|---|
| What do I do next? | [`CHECKLIST.md`](./docs/CHECKLIST.md) |
| Why is the schedule like this? | [`ROADMAP.md`](./docs/ROADMAP.md) |
| Why was X decided that way? | [`BUILD_LOG.md`](./docs/BUILD_LOG.md) |
| What are the tables and endpoints? | [`DEVELOPER_SPEC.md`](./docs/DEVELOPER_SPEC.md) |

---

## 3. Get it running

```bash
git clone https://github.com/LandCruiserWorld/commonmind.git
cd commonmind
npm install
npm run check     # TypeScript type-check — should be silent
npm test          # should pass 1/1

npx skills add cockroachlabs/cockroachdb-skills   # official CockroachDB agent skills
```

If `check` and `test` both pass, your environment is fine. There's no application code yet — that's what we're about to write.

The last command installs 34 official CockroachDB agent skills. Two are worth reading before you start: **`setting-up-local-cluster`** and **`provisioning-cluster-for-production`** — they cover your first task directly.

---

## 4. Your first task

**Provision a multi-node CockroachDB Cloud cluster with `ccloud`, and apply the schema to it.**

This is the single blocking item. It gates the kill-the-node demo — the highest-scoring artifact in the whole submission — and `ccloud` is itself one of the four CockroachDB tools the rules require us to use, so doing it *is* progress on two fronts.

```bash
# after ccloud auth + cluster create
cockroach sql --url "$COCKROACH_DB_URL" -e "CREATE DATABASE commonmind;"
cockroach sql --url "$COCKROACH_DB_URL" --database commonmind < src/db/schema.sql
cockroach sql --url "$COCKROACH_DB_URL" --database commonmind -e "SHOW TABLES;"
```

**Done when:** `SHOW TABLES` returns `memory_records`, `memory_embeddings`, `memory_consolidations`, `memory_events`, `notifications`, `live_activities`, `services`, `devices`.

Then tick it off in the checklist.

---

## 5. Three things that will bite you

These have already cost us time. They're the difference between a smooth first day and a confusing one.

**CockroachDB is not Postgres.** It speaks the Postgres wire protocol and most of its syntax — which is why we use the `pg` driver and a `postgresql://` connection string — but it is *not* a fork. pgvector syntax does **not** work:

```sql
-- ❌ pgvector. Will not run.
CREATE INDEX ON memory_embeddings USING hnsw (embedding vector_cosine_ops);

-- ✅ CockroachDB. Backed by C-SPANN.
CREATE VECTOR INDEX ON memory_embeddings (embedding vector_cosine_ops);
```

When a Postgres answer and a CockroachDB doc disagree, the doc wins.

**Never use a sequential primary key.** `SERIAL`/`BIGSERIAL` sends every insert to the same range and creates a write hotspot — the classic CockroachDB anti-pattern. Use `UUID DEFAULT gen_random_uuid()` or `unique_rowid()`.

**Embeddings are `VECTOR(1024)`** — Amazon Titan Text Embeddings V2's native size. Any other dimension fails on insert. The reasoning is in [`BUILD_LOG.md`](./docs/BUILD_LOG.md).

---

## 6. How we work

- **Record decisions in [`BUILD_LOG.md`](./docs/BUILD_LOG.md)** — the decision *and* why. A decision without a recorded reason gets argued about again next week.
- **Take a screen grab of anything that works.** Five seconds is enough. The video is due Aug 14 and you cannot re-shoot a moment you didn't capture.
- **Cut from the bottom.** When time runs short there's an agreed order in [`ROADMAP.md`](./docs/ROADMAP.md) §3. Capture→recall is never cut.
- **Don't publish a number we haven't measured.** Anything unmeasured is labelled a target or removed before Aug 13.

---

## The one invariant

A memory record and its embedding **commit in the same transaction**. Always.

```sql
BEGIN;
  INSERT INTO memory_records (entity_type, content) VALUES ($1, $2) RETURNING id;
  INSERT INTO memory_embeddings (entity_type, entity_id, embedding) VALUES ($1, $id, $3::vector);
COMMIT;
```

There must be no window where something happened but isn't yet retrievable. Any change that splits these two writes is wrong, however much faster it is. That guarantee is the product.

Welcome aboard.
