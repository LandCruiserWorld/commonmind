# CommonMind — Docs

**New to the project? Read [`../CONTRIBUTING.md`](../CONTRIBUTING.md) first** — it's the 15-minute path in.

This page is the map. Read the precedence rules before following any plan in this folder.

---

## 🧭 If you only read one thing

**[`CHECKLIST.md`](CHECKLIST.md) is the single source of truth for what to do next.**

It owns the build-out by capability, the daily gates, the submission requirements, and the pre-flight lists. If another document in this folder contains a date or a task that contradicts the checklist, **the checklist wins** — the others are retained for their reasoning, not their scheduling.

---

## Precedence

| # | Document | Owns | Follow it for |
|---|---|---|---|
| **1** | [**CHECKLIST.md**](CHECKLIST.md) | What to do next | Today's work. Authoritative on all tasks and dates |
| **2** | [ROADMAP.md](ROADMAP.md) | Why the schedule looks like this | The critical path, the cut ladder, why cluster provisioning moved earlier |
| **3** | [BUILD_LOG.md](BUILD_LOG.md) | Decisions and their reasoning | "Why is it 1024 dims?" · "Why not DynamoDB?" · verification history |
| **4** | [DEVELOPER_SPEC.md](DEVELOPER_SPEC.md) | Schema and API contract | Table definitions, endpoints, component design |
| **5** | [MASTER_DEVELOPER_DOC.md](MASTER_DEVELOPER_DOC.md) | The why, the agents, the judging map | Positioning, the three agents, video shot-list, risk register |
| **6** | [STRATEGIC_PLAN.md](STRATEGIC_PLAN.md) | Strategy and competitive framing | Why we win, the L1–L4 priority ladder |
| **7** | [DREAM_WEAVER_SPEC.md](DREAM_WEAVER_SPEC.md) | The Dream-Weaver design only | Mon Aug 10 consolidation work. Capability spec, not a schedule — L4, cuttable |

> ⚠️ The day-by-day schedules inside **MASTER_DEVELOPER_DOC §4** and **STRATEGIC_PLAN §6** are **superseded**. They assume an Aug 3 start the build didn't follow. Both are banner-marked in place. Use the checklist for dates.

---

## Runbooks

- [**PUBLISHING.md**](PUBLISHING.md) — shipping the `commonmind` npm package. Read before your first `npm publish`; the `files` field is load-bearing and easy to break.

---

## For coding agents

Read [`agents/AGENTS.md`](agents/AGENTS.md) first — it states the invariants you must not break. Then take work from [`CHECKLIST.md`](CHECKLIST.md), never from a schedule in another file.

When you make a decision, record it in [`BUILD_LOG.md`](BUILD_LOG.md) with the reasoning, not just the outcome.

---

## The product story

- [Landing page](site/index.html) — the narrative plus the embedded `#commonmind-bible` JSON-LD that agents can parse. **Single copy**, deployed to <https://commonmind.agent9.dev>. Do not fork a second landing page.
