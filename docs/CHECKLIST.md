# CHECKLIST — the daily driver

**Deadline: Tue Aug 18, 2026 @ 5:00 PM EDT.**

Open this every morning. Tick things off. It's deliberately thin — the reasoning lives elsewhere:

| This doc owns | Goes here instead |
|---|---|
| What to tick off, today | [`ROADMAP.md`](./ROADMAP.md) — why the schedule is shaped this way, the critical path, the cut ladder |
| — | [`BUILD_LOG.md`](./BUILD_LOG.md) — decisions and their rationale |
| — | [`DEVELOPER_SPEC.md`](./DEVELOPER_SPEC.md) — schema, API contract |
| — | [`MASTER_DEVELOPER_DOC.md`](./MASTER_DEVELOPER_DOC.md) — the why, the agents, the judging map |

**Rule:** if you want to write *why* on this page, it belongs in one of those. Keep this page tickable.

---

## 🔥 Blocking right now

> ✅ **Aug 4 evening — the cluster is up and the schema is applied.** The critical path is unblocked. Next gate is Wed Aug 5: capture → recall.

- [ ] **Enable CockroachDB's Managed MCP Server** — Cloud console → cluster → **Connect** → MCP, paste the snippet into your client. Two minutes, read-only, RBAC-checked. *A required tool, and a separate thing from the CommonMind MCP server we build ourselves.* Cloud-only — it cannot run against a local cluster

- [x] ~~`ccloud` provisions a **multi-node** cluster~~ ✅ **Aug 4**
- [x] ~~`CREATE DATABASE commonmind` + apply schema~~ ✅ **Aug 4**
- [x] ~~`SHOW TABLES` returns the memory core~~ ✅ **Aug 4 — all 8 tables verified**
- [x] ~~Fix the site's JSON-LD `mcp` state~~ ✅ **Aug 4 — live**

---

## Week 1 — the critical path

Gates are binary. Met or not met, checked end of day. Detail in [`ROADMAP.md` §4](./ROADMAP.md).

### Tue Aug 4
- [x] Vector dimension decided — `VECTOR(1024)`, Titan v2
- [x] `getPool()` wired to `loadConfig()`
- [x] Write path decided — `memory_records` canonical
- [x] ~~Multi-node cluster live, schema applied~~ ✅
- [x] ~~Partner's dev environment clean~~ ✅ — `npm test` was broken on Node 20 (quoted glob); fixed Aug 4

### Wed Aug 5 — the wedge
**Gate: `capture` → `ask` works end to end on the cloud cluster.**
- [ ] `src/embed.ts` — Bedrock `titan-embed-text-v2:0`; string in → **1024 floats** out
- [ ] Wire the `EMBED_PROVIDER` `local | bedrock` toggle
- [ ] First real run of `remember()` — row + vector, **one transaction**
- [ ] First real run of `recall()` — query returns it with a similarity score
- [ ] Minimal CLI: `commonmind capture "…"` / `commonmind ask "…"`. No flags
- [ ] 🎥 Record the 10-second hook **the hour it works**. Rough is fine

> Short on time? Cut the CLI and prove it with a script. The gate is capture→recall, not ergonomics.

### Thu Aug 6 — human in the loop
**Gate: an approval survives killing the agent mid-flight.**
- [ ] Write the `notifications` row transactionally
- [ ] State machine: `pending → approved | denied | expired`, honouring `correlation_id` and `expires_at`
- [ ] `commonmind ask --approval "…"` waits on the decision
- [ ] Commit the decision back as memory — *this is what makes it CommonMind and not a notifier*
- [ ] Start an approval, `kill -9` the agent, restart, confirm it resumes. 🎥 Record it

**Also today — the CommonMind MCP server, first three tools:**
- [ ] `commonmind serve-mcp` exposing `memory.capture`, `memory.recall`, `memory.ask` — a protocol wrapper over the `remember()`/`recall()` that went live yesterday
- [ ] HTTP transport (**not SSE** — deprecated in MCP and excluded by Cockroach's own server)
- [ ] Connect one CLI to it and capture a memory through MCP rather than the CLI

> No web UI or phone push needed today. A row plus a CLI read proves the state machine.
>
> ⚠️ **If the day is too full, the approval state machine wins and MCP slides to Friday.** Approval is the human-in-the-loop differentiator; MCP is a wrapper over work that already exists.

### Fri Aug 7 — the pipeline
**Gate: a push fires from a committed row, not from application code.**
- [ ] `CREATE CHANGEFEED` on the memory tables
- [ ] SNS + SQS + **DLQ** (the DLQ is a Production Readiness scoring item)
- [ ] Lambda fanout worker consuming SQS
- [ ] Minimal web inbox — unstyled is fine
- [ ] Test: delete the fanout Lambda; memory should still be correct

**Also today — finish the MCP surface:**
- [ ] Add `memory.approve` and `memory.note` now that Thursday's state machine exists
- [ ] **Start dogfooding:** point your own coding agent at CommonMind and let it capture as you work. Every day from here generates real usage — and authentic demo footage — for free

> Biggest risk of the three days, and it depends on AWS being ready. **If AWS isn't ready Thursday night, say so Thursday** — not Friday afternoon.

### Sat Aug 8 — resilience rehearsal
- [ ] Kill one node on the real cluster; recall uninterrupted
- [ ] Understand it well enough to narrate it live
- [ ] **Gate: rehearsed, not recorded**

### Sun Aug 9 — buffer
- [ ] Whatever slipped this week lands here. **Don't compress Thursday to protect Wednesday** — that's what this day is for
- [ ] **Gate: critical path complete through CDC**

---

## Week 2 — differentiate, then freeze

### Mon Aug 10 — Dream-Weaver
- [ ] Surprise scoring + pattern extraction
- [ ] Before/after recall measured on the same question set
- [ ] **Gate: a real learning curve — or the "improves itself" claim comes off the site**

### Tue Aug 11 — tools
- [ ] `docs/agents/` guide files per CLI — the per-app `AGENTS.md` / `SKILL.md` that tell each agent our MCP tool surface
- [ ] Verify both MCP servers in one demo: Cockroach's managed server introspecting, ours capturing
- [ ] ccloud self-ops agent (provision / backup / RBAC, JSON out)
- [ ] **Gate: two different CLIs recall the same memory**

### Wed Aug 12 — integration
- [ ] One real integration end to end (trading bot is the strongest existing evidence)
- [ ] **Gate: an outside system writes and reads memory**

### Thu Aug 13 — measure
- [ ] Multi-node benchmark run
- [ ] Real numbers into the README
- [ ] Landing-page performance figures replaced with measurements **or removed**
- [ ] **Gate: no unmeasured number remains published**

### Fri Aug 14 — 🎥 record
- [ ] Kill-the-node scene first, early in the day
- [ ] All six scenes per the shot list in [`MASTER_DEVELOPER_DOC.md` §4](./MASTER_DEVELOPER_DOC.md)
- [ ] **Gate: footage in hand, under 3:00, with a pre-recorded fallback**

### Sat Aug 15 — publish
- [ ] Final cut, public on YouTube
- [ ] Three live rehearsals
- [ ] **Gate: demo runs clean twice consecutively**

### Sun Aug 16 — 🧊 freeze
- [ ] **Feature freeze.** Demo-blocking bugs only
- [ ] **Gate: repo, demo URL and video all stable**

### Mon Aug 17 — dry run
- [ ] Every submission field filled, every link opened and checked
- [ ] **Gate: draft submitted, not merely drafted**

### Tue Aug 18 — submit
- [ ] **Submit by mid-morning.** Not 5 PM

---

## Build-out by capability

The same work as the daily gates above, organised by *what we're building* rather than *when it's due*. Moved here from `BUILD_LOG.md` so one document owns the actionable plan.

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

## Submission requirements

From the [official rules](https://cockroachdb-ai.devpost.com/). Verify each one by *opening the link in a logged-out browser*, not by remembering you did it.

- [ ] **Public** repo — open it in a private window to confirm
- [ ] **Apache-2.0** license detectable in the GitHub **About** panel *(currently ✅)*
- [ ] Repo contains all source, a clear README, dependencies, example config, and setup-and-run instructions that actually work on a clean machine
- [ ] Functional **demo URL**, loading right now
- [ ] Video **under 3:00**, public, on YouTube or Vimeo
- [ ] Stated: which **CockroachDB tools** used and **HOW** — minimum two ([README table](../README.md#hackathon-compliance))
- [ ] Stated: which **AWS services** used and **HOW** — minimum one
- [ ] *Optional:* architecture diagram — ✅ [`assets/images/aws-serverless-architecture.svg`](../assets/images/aws-serverless-architecture.svg)
- [ ] *Optional:* feedback for Cockroach Labs — **we have real material**: the official skills repo ships 34 ops skills and none for vector indexing or changefeeds, the two features an agentic-memory build needs most. See [`BUILD_LOG.md`](./BUILD_LOG.md)

---

## Before you hit record

- [ ] Fresh cluster, rehearsed at least twice
- [ ] Kill-the-node **pre-recorded** as insurance — never attempt it cold
- [ ] Terminal font large enough to read on a phone
- [ ] Notifications silenced on every device on screen
- [ ] No secrets, tokens, or private repos visible in any frame
- [ ] Script trimmed to fit 3:00 with ~15 seconds of headroom

---

## Before you hit submit

- [ ] Every claim in the README is either measured or labelled a target
- [ ] Site and repo agree — no `state:"done"` on anything that isn't
- [ ] `npm install && npm run check && npm test` passes on a **clean clone**
- [ ] Quickstart followed literally, on a machine that has never run this
- [ ] All links resolve logged out
- [ ] Video is public, not unlisted

---

## Continuous

- [ ] 🎥 5-second screen grab of every deliverable, for B-roll. You will not regret excess footage
- [ ] Update [`BUILD_LOG.md`](./BUILD_LOG.md) when a decision is made — decision *and* reasoning
- [ ] Cut from the bottom of the L1–L4 ladder, never the top ([`ROADMAP.md` §3](./ROADMAP.md))

---

## Open, not yet blocking

- [ ] Test covering the atomic-write invariant — principle #1 has no test
- [ ] **End-to-end latency measurement.** The `<50ms` recall figure is database-side. Measure the full path — client → Lambda (cold *and* warm) → Bedrock embed → C-SPANN search → response — and publish both numbers, or drop the claim. Do it before the Aug 13 benchmark gate
- [ ] Threshold policy: milestone → priority escalation, per-agent or per-workflow?
- [ ] Local-first vs cloud-first for the demo run
- [ ] Register `commonmind.dev` + the npm name (both free as of Aug 4)
- [x] ~~GitHub repo description~~ — set Aug 4, with homepage + 8 topics
- [x] ~~`CONTRIBUTING.md`~~ — written Aug 4 as the team onboarding path
- [ ] Docs scaffold: `docs/api/API.md`, `docs/architecture/ARCHITECTURE.md`, `SECURITY.md`, `CHANGELOG.md`, `.github/` issue templates

---

## Done means

> A stranger watches the video and says: *"Oh — it remembers, and it survives a failure. I want to use it."*

Plus, on paper: two or more CockroachDB tools used correctly, one or more AWS services, measured benchmarks, and packaging that reads like a product rather than a prototype.
