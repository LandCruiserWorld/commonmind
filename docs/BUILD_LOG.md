# CommonMind — Build Log & Progress

_Status legend:_ ✅ done · 🟡 in build · ⏳ next · ⬜ later.

Built for the **[CockroachDB × AWS Hackathon — Build with Agentic Memory](https://cockroachdb-ai.devpost.com/)**. Deadline **Aug 18, 2026 @ 5:00pm EDT**.

## The 10 immutable principles (do not violate)

1. **Memory is the product** — not an afterthought bolted onto an app.
2. **Memory must never go down** — an agent whose memory goes offline doesn't degrade gracefully; it stops.
3. **Bridge, don't flood** — we close the gap between what agents do and what people know — with signal, not spam.
4. **Milestones, not noise** — record everything; alert only on start, needs-you, and done-differently.
5. **Human decides, agent executes** — autonomous on safe work; consequential decisions stop for a person.
6. **One memory framework, any product** — Swiss Army Knife: trading, games, apps, code.
7. **Brain health, not timecard** — participation is vitality, not surveillance.
8. **The front door matters** — one command, zero accounts to see the magic.
9. **Memory improves itself** — consolidation makes it measurably better over time.
10. **Kill the node, memory survives** — resilience is recorded on camera, not claimed in a README.

---

## Phase 0 — Foundation
- [✅] Landing page / product bible (premium redesign, machine-readable JSON-LD spec)
- [✅] 10 principles + `#commonmind-bible` JSON-LD (agents read it to stay on track)
- [🟡] `npm install -g commonmind` front door → local CockroachDB + `save / ask / ask --approval`
- [🟡] **CommonMind MCP server** (universal adapter: capture · recall · ask · approve · note) — no per-app plugins

## Phase 1 — Core loop (Week 1)
- [⏳] `commonmind capture` / `commonmind ask` — atomic write + semantic recall (DB-b `pg`)
- [⏳] C-SPANN vector index + atomic-write invariant (row + embedding, one txn)
- [⏳] Approval request → human phone decision → callback resume
- [⏳] CLI capture hooks (Claude Code, opencode, etc.)

## Phase 2 — Product & resilience (Week 2)
- [ ] Web inbox / PWA push surface
- [ ] CDC → SNS → Lambda push pipeline
- [ ] Kill-the-node demo (multi-region / multi-node GLOBAL)

## Phase 3 — Differentiation (Week 3)
- [ ] Dream-weaver consolidation (surprise scoring + patterns) — self-improving memory
- [ ] ccloud CLI self-management agent (provision / backup / RBAC, JSON-out)
- [ ] CommonMind MCP server → all CLIs (Claude, Cursor, Codex, opencode, Copilot)
- [ ] Multi-node benchmark + README + arch diagram
- [ ] Submission packaging + demo video

---

## Verification snapshot (pre-build) — Aug 3
Confidence/readiness audit only — no product features built yet.
- `npm run check` (tsc) ✅ clean.
- `npm test` ✅ 1/1 passes — **harness fixed** (was broken: `node --test tests/` can't run `.ts`; added `tsconfig.test.json`, tests compile to `.test-dist/`).
- Local CockroachDB: running `v25.2.3` at `127.0.0.1:26257` (CCL) ✅ — reachable from `pg`.
- **Gap:** database `commonmind` does NOT exist; `schema.sql` was never applied. Tables (`memory_records`, `memory_embeddings` C-SPANN, `memory_consolidations`) are design-only right now.
- **Gap for exact criteria fit:** no live agent loop, no AWS deployment artifacts, no end-to-end capture→recall proof.
- Ready-to-build instructions derived: 1) create DB + apply `schema.sql`, 2) prove `remember()`/`recall()` atomic-write against real cluster, 3) then agents + AWS.

## Decisions locked
- **Language:** TypeScript/Node (bench shows both bottleneck on the DB write path — velocity wins).
- **Storage:** CockroachDB (Cloud GLOBAL for demo/video; single-node for dev).
- **Push surface:** Inbox/PWA MVP; native FCM/APNs a stretch (no App Store for the demo).
- **Demo faces:** Solana trading platform (Raspberry Pi + Tailscale), dev-team coding, game (creature remembers).
- **Naming:** CommonMind.

## Repo review — Aug 4 (pre-handoff to dev team)

Fixed in this pass:
- **`USING hnsw` was invalid SQL for CockroachDB.** CockroachDB has no HNSW; it uses **C-SPANN** (hierarchical K-means partition tree from Microsoft's SPANN). All index DDL is now `CREATE VECTOR INDEX ... (embedding vector_cosine_ops)`. This would have failed the moment `schema.sql` was first applied.
- **`memory_events.seq` was `BIGSERIAL`** — a sequential PK funnels every insert into one range and hotspots our hottest write path. Now `INT DEFAULT unique_rowid()`.
- **Added `memory_embeddings (entity_id)` index** — `recall()` joins on it; without it the join scans.
- `withTransaction` no longer lets a failing `ROLLBACK` mask the original error.
- License references corrected MIT → Apache-2.0 (LICENSE, `package.json` and GitHub all say Apache-2.0).
- `"private": true` removed from `package.json` — it blocked the `npm install -g commonmind` front door promised in Phase 0.
- Removed competitor name ("Hark") and `harkctl` from the public spec; CLI is `commonmind`.
- Deleted `docs/landing.html`, a byte-identical duplicate of `docs/site/index.html` that had already drifted once.
- Repaired rename artifacts where "Cortex" had been a common noun ("THE MEMORY CORTEX" → "THE MEMORY LAYER").

**Open — needs a decision before the team builds:**
- [✅] **Embedding dimension — DECIDED Aug 4: `VECTOR(1024)`, Amazon Titan Text Embeddings V2 at its native default.** The schema previously said 768, inherited from the KeenDreams port where 768 is Cloudflare Workers AI's `bge-base` size. No Bedrock model emits 768. Titan v2 emits 1024 (default), 512 or 256; Titan v1 emits 1536. **v1 was rejected:** v2 is priced at $0.02 per million input tokens, a **5× reduction** on v1, produces a ~33% smaller index, and is the retrieval-optimised second generation. **512/256 were rejected for now:** they're Matryoshka truncations retaining ~99% and ~97% recall respectively — a legitimate optimisation *after* submission, but the Dream-Weaver's "measurably better over time" claim needs a clean baseline, and at our corpus size (1024 × 4 bytes = 4 KB/vector) storage is not a constraint. Changed in 9 places while the database still doesn't exist, so this cost nothing; after capture→recall goes live it would mean re-embedding everything.
- [ ] **`getPool()` ignores `loadConfig()`** — `db.ts` reads `process.env.COCKROACH_DB_URL` directly, so the config fallback DSN is dead code. Unset env → `pg` defaults to **localhost:5432** (Postgres), not 26257. Should be `getPool(loadConfig().dbUrl)`.
- [ ] **Spec and code disagree on the write path.** `repository.ts` writes `memory_records` + `memory_embeddings`; `memory_records` appears nowhere in DEVELOPER_SPEC or MASTER_DEVELOPER_DOC, whose atomic-write invariant describes `notifications` + `memory_embeddings`. Decide which is canonical, then converge.
- [ ] **No test covers the atomic-write invariant** — principle #1, and the only test asserts a string from `hello()`.

## Open decisions
- [✅] Final name confirmation — **CommonMind** (settled Aug 4; renamed from "Cortex", which collides with 8+ live AI-memory products including Harper's)
- [ ] Threshold policy for milestone → priority escalation (per-agent or per-workflow?)
- [ ] Local-first vs Cloud-first for the demo run