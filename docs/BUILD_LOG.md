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
- [⏳] HNSW vector index + atomic-write invariant (row + embedding, one txn)
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
- **Gap:** database `commonmind` does NOT exist; `schema.sql` was never applied. Tables (`memory_records`, `memory_embeddings` HNSW, `memory_consolidations`) are design-only right now.
- **Gap for exact criteria fit:** no live agent loop, no AWS deployment artifacts, no end-to-end capture→recall proof.
- Ready-to-build instructions derived: 1) create DB + apply `schema.sql`, 2) prove `remember()`/`recall()` atomic-write against real cluster, 3) then agents + AWS.

## Decisions locked
- **Language:** TypeScript/Node (bench shows both bottleneck on the DB write path — velocity wins).
- **Storage:** CockroachDB (Cloud GLOBAL for demo/video; single-node for dev).
- **Push surface:** Inbox/PWA MVP; native FCM/APNs a stretch (no App Store for the demo).
- **Demo faces:** Solana trading platform (Raspberry Pi + Tailscale), dev-team coding, game (creature remembers).
- **Naming:** CommonMind.

## Open decisions
- [ ] Final name confirmation (`commonmind`)
- [ ] Threshold policy for milestone → priority escalation (per-agent or per-workflow?)
- [ ] Local-first vs Cloud-first for the demo run