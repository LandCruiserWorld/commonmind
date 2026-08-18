# ROADMAP — re-baselined Aug 4, 2026

**14 days to deadline: Tue Aug 18, 2026 @ 5:00 PM EDT.**

This document does not replace the plan. [`MASTER_DEVELOPER_DOC.md`](./MASTER_DEVELOPER_DOC.md) is still the why and the what; [`STRATEGIC_PLAN.md`](./STRATEGIC_PLAN.md) still owns the L1–L4 priority ladder; [`DEVELOPER_SPEC.md`](./DEVELOPER_SPEC.md) still owns the schema and API contract. This is the **schedule corrected against reality**, because the original plan's day-by-day assumed Day 1 shipped and it didn't.

---

## 1. Where we actually are

**Day 1 went into strategy instead of scaffolding, and that was the right trade.** In a single day (Aug 3) the project produced: the public repo under Apache-2.0, the full product core values with a machine-readable JSON-LD spec, `MASTER_DEVELOPER_DOC` (the why, the agents, the judging-criteria map), `STRATEGIC_PLAN` (positioning and the L1–L4 cut ladder), `DEVELOPER_SPEC` (schema and API contract), the CockroachDB schema, the TypeScript memory core, and a designed landing page.

That is why the next 14 days are **execution rather than discovery** — the hard thinking is done, the cut order is already agreed, and the judging criteria are already mapped to deliverables. Most hackathon entries reach Aug 18 without a document this good.

**The consequence, stated plainly:** the build gates shifted right. As of today the following are true and both sit on the critical path.

| | State |
|---|---|
| Repo, license, structure, name | ✅ Done |
| Product core values, spec, strategy, plan, landing page | ✅ Done — and deeper than the plan required |
| Schema **written** | ✅ `src/db/schema.sql` |
| Schema **applied** | ❌ Database `commonmind` does not exist |
| Cluster provisioned via `ccloud` | ❌ Not started — and it's a required tool *and* the kill-the-node dependency |
| `commonmind capture` / `ask` | ❌ Not started |

Evidence: [`BUILD_LOG.md`](./BUILD_LOG.md) verification snapshot — *"database `commonmind` does NOT exist; `schema.sql` was never applied."*

**Net position:** the plan front-loaded thinking, so the build starts on Day 2 rather than Day 1 — on a schedule whose Week 1 has a gate every single day and no slack. That's fine if the cluster lands today. It compounds if it's still true on Friday.

---

## 2. The critical path

Of everything in the plan, exactly one chain decides whether there's a submission:

```
ccloud provisions a multi-node cluster
  → schema applied to it
    → capture → recall proven against it
      → kill-the-node recorded
        → video cut
```

Everything else — Live Activities, the web inbox, four integrations, native push — is off this chain. If the chain completes and nothing else does, there is a credible submission. If the chain slips, nothing else saves it.

**The re-baseline's one structural change: pull cluster provisioning to today.** The original plan has the multi-node cluster arriving around the benchmark on Aug 13, with kill-the-node recorded Aug 14. That leaves a single day of slack on the highest-risk, highest-scoring artifact in the entire submission, and the cluster is also one of the four required CockroachDB tools (`ccloud`). Provisioning it on Day 2 converts the schedule's biggest risk into its earliest task — and yields self-ops video B-roll for free, exactly as `STRATEGIC_PLAN.md` §12 anticipated.

---

## 3. The cut ladder (unchanged — from STRATEGIC_PLAN §5)

When time runs short, cut from the bottom. This ladder is already agreed; it is restated here because a schedule without a cut order isn't a schedule.

| | Layer | Status |
|---|---|---|
| **L1** | Capture → Embed → Store → Recall in CockroachDB | **Non-negotiable.** This is the memory. Never cut. |
| **L2** | Agent acts on memory; approval push; Live Activity state machine | High value. Approval round-trip is the human-in-the-loop story. |
| **L3** | Hooks API, idempotency, DLQ, provider interface | Cut Live Activities and native push first. |
| **L4** | CDC → SNS → push, Dream-Weaver, ccloud self-ops, MCP introspection | Cut Dream-Weaver last of the L4s — it's the creativity score. |

> *"If time dies at L2, we STILL have a winning memory + recall + an agent acting. Do NOT lose L1."*

**Judged consequence of each cut:** losing L4's Dream-Weaver costs Creativity & Originality. Losing CDC costs the "memory write *is* the notification" claim. Losing L2's approval costs the human-in-the-loop differentiator. Losing L1 costs the entire submission.

---

## 4. Re-baselined schedule

Two people from today. Gates are binary — met or not met, checked at end of day.

### This week — get back on the critical path

| Day | Owner | Deliverable | Gate |
|---|---|---|---|
| **Tue Aug 4** *(today)* | Partner | Dev env; `ccloud` provisions a **multi-node** cluster; `schema.sql` applied to both local and cloud | `SHOW TABLES` returns the memory core on a real cluster |
| **Tue Aug 4** | ~~Terry~~ | ✅ **Done.** All three decisions settled and recorded: `VECTOR(1024)` Titan v2, `getPool()` wired to config, `memory_records` canonical | Build has no ambiguity left |
| **Wed Aug 5** | Both | `commonmind capture` + `commonmind ask` against the cloud cluster; Bedrock embeddings wired | **Capture → recall works end-to-end.** Record the 10-second hook video the same hour |
| **Thu Aug 6** | — | Approval round-trip: request → notification row → decision → agent resumes | Approve/deny survives killing the agent process mid-flight |
| **Fri Aug 7** | — | CDC changefeed → SNS → SQS → Lambda fanout → web inbox | A push fires from a committed DB row, not from application code |
| **Sat Aug 8** | — | **Kill-the-node rehearsal on the real cluster.** Not the recording — the rehearsal | One node killed, recall uninterrupted, understood well enough to narrate |
| **Sun Aug 9** | — | Week-1 review. Buffer day: whatever slipped lands here | Critical path complete through CDC |

### Next week — differentiate, then freeze

| Day | Deliverable | Gate |
|---|---|---|
| **Mon Aug 10** | Dream-Weaver consolidation; surprise scoring; before/after recall measurement — spec: [`DREAM_WEAVER_SPEC.md`](DREAM_WEAVER_SPEC.md) | A learning curve with real numbers, or the claim comes off the site |
| **Tue Aug 11** | MCP server + `docs/agents/` guides; ccloud self-ops agent | Two different CLIs recall the same memory |
| **Wed Aug 12** | One real integration end-to-end (trading bot is the strongest existing evidence) | An outside system writes and reads memory |
| **Thu Aug 13** | Multi-node benchmark; real numbers into README; landing-page targets replaced or removed | No unmeasured number remains published |
| **Fri Aug 14** | **Record the video.** Kill-the-node scene first, while the day is young | Footage in hand, under 3:00, with a pre-recorded fallback |
| **Sat Aug 15** | Final cut published to YouTube; three live rehearsals | Demo runs clean twice consecutively |
| **Sun Aug 16** | **Feature freeze.** Demo-blocking bugs only | Repo, demo URL and video all stable |
| **Mon Aug 17** | Submission dry run — every field, every link | Draft submitted, not just drafted |
| **Tue Aug 18** | **Submit by mid-morning**, not 5 PM | Submitted with hours of buffer |

---

## 5. Standing rules

Carried from the plan because they're what keeps it honest:

1. **The demo is the product.** Every deliverable gets a 5-second screen grab for the B-roll archive. You will never regret having too much footage.
2. **Never attempt kill-the-node cold.** Pre-record it. Rehearse on a fresh cluster before the take.
3. **Freeze on Aug 16.** Days 15–16 are packaging and rehearsal, not features.
4. **Don't lose the wedge.** Capture→recall is the thing a stranger understands in ten seconds.
5. **No unmeasured claims ship.** Anything on the site or in the README that isn't measured is labelled a target or removed before Aug 13. A number a judge can't reproduce is worse than no number.

---

## 6. Open decisions blocking the build

These stop the team today. Detail in [`BUILD_LOG.md`](./BUILD_LOG.md).

| # | Decision | Blocks |
|---|---|---|
| ~~1~~ | ~~**Vector dimension**~~ — ✅ **CLOSED Aug 4: `VECTOR(1024)`, Titan v2 default.** v1 rejected (5× price, larger index, not retrieval-optimised); 512/256 deferred as a post-submission optimisation. Rationale in [`BUILD_LOG.md`](./BUILD_LOG.md) | — |
| ~~2~~ | ~~**`getPool()` config wiring**~~ — ✅ **FIXED Aug 4.** Now defaults to `loadConfig().dbUrl`; `closePool()` added | — |
| ~~3~~ | ~~**Write path**~~ — ✅ **DECIDED Aug 4: `memory_records` canonical.** Most memory is silent, so notifications are a downstream subset, not the capture table. Spec and diagram converged onto the code | — |

---

## 7. Risk register (delta from MASTER_DEVELOPER_DOC §5)

The original risks stand. Three more are live as of today:

| Risk | Impact | Mitigation |
|---|---|---|
| **Week 1 has a gate every day and no slack** | High — one bad day cascades | Aug 9 is now an explicit buffer day |
| **Multi-node cluster was scheduled 9 days before the video** | High — it gates the thesis shot | Pulled to Aug 4 |
| **Site claims the MCP server is `"state":"done"`** in public JSON-LD | Medium — it's the easiest claim for a judge to check, and it's false | Correct the build-log state on the site |
