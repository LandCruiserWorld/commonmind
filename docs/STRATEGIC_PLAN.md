# STRATEGIC DEVELOPMENT PLAN — Perpetual Memory Cortex
### CockroachDB × AWS Hackathon — Build with Agentic Memory
**Deadline:** Aug 18, 2026 @ 5:00 PM EDT · **Today:** Aug 03, 2026 → ~15 days

---

## 0. One-Sentence North Star

> Build a *Webhook → Agent → Phone* notification + approval platform where **CockroachDB is the transactional, globally-replicated, self-improving memory layer** — then *prove* that memory is the product by killing the database live and showing zero data loss.

This document is the *why* and *how-to-win* strategy. The *what-to-build* lives in [`DEVELOPER_SPEC.md`](./DEVELOPER_SPEC.md).

---

## 1. Why We Win (The Strategy Stack)

This is a 5-layer thesis — each layer separately defensible, together they win multiple judging criteria and — critically — are *all learnable in a 30-second demo*.

**Layer 1 — The Wedge (Onboarding):** capture → recall. "One command remembers everything." This is what users touch first, and it's the KeenDreams proved loop (already built, already integrated with a real crypto-trading app + CLI). It is the most relatable, believable use case on the board.

**Layer 2 — The Agent (Act):** an agent *uses* that memory to decide, runs on your phone via approval and Live Activity. Turns a memory product into an agent product.

**Layer 3 — The Product (Hark-style, but ours):** webhook → notifications + approvals + Live Activities. It's a *real* tool developers/CI/agents genuinely want.

**Layer 4 — The Technology (CockroachDB):** atomic writes, changefeeds, distributed vector indexing, MCP, ccloud. This is what gets the "technical implementation" points and what most teams will be missing.

**Layer 5 — The Demo (the kill-shot):** "Kill the node, memory survives." This is the eyebrow-raiser that closes the pitch and is the theme's central thesis made visible.

---

## 2. Positioning & Competitive Landscape

We are NOT building "another webhook-to-push tool." That is Hark and a dozen others. We are building the same UX **with memory as the product**, which changes what you *can do*:

| Feature | Hark (you benchmark) | Us (differentiator) |
|---|---|---|
| Push/approval/Live Activity | Yes | Yes |
| Memory is the internal store | (opaque — likely a single-region DB) | **CockroachDB, globally replicated, ALWAYS-ON** |
| Semantic recall of past events | No | Yes (`/api/memory/search`) |
| Self-improving consolidation | No | Yes (dream-weaver agents) |
| Agent self-manages infra | No | Yes (ccloud CLI, backups, RBAC) |
| Survives kind-a failure in demo | No | Yes ("kill the node" story) |
| **Tight integrations** (crypto app, CLI) | No | Yes — already built |

**What this means for judging:** we're not asking judges to trust a hope. We lead with *existing, working integrations* (cryptotrading app + CLI) as evidence of usefulness, then show the memory layer is what makes them "actually useful."

**Interviewee note:** Hark's UX (device pairing, service default avatars, `deviceIds`, Live Activity styles) is a strong reference. Borrow, don't clone — our value is memory-first, not "one more modal."

---

## 3. Strategy Architecture: What We Win & the Comps

### 3.1 Judging Criteria → Our Play

| Criterion (weight implied) | Our play | Delivered by |
|---|---|---|
| **Agentic Memory Design** | CockroachDB is the *system of record* for events, approvals, *and* contexts; atomic write = row+embedding; changefeeds drive pushes | L1 capture→recall barrier layers; L2-4 real TLAs. This is the #1-weighted criterion. **Potential #1 win.** |
| **Technical Implementation** | All 4 tool-families used correctly, CDC, cheap cold-starts, correct postgres | Months of both specs. fix |
| **Real-World Impact** | Agents/CI/dev genuinely need push-back; existing real integrations | Existing integrations + believable use cases (CI/deploy/crypto) |
| **Production Readiness** | Idempotency, DLQ, retries, RBAC/audit-via-MCP, multi-region, changefeed replay | Built-in to spec |
| **Creativity & Originality** | "Memory is the product + it self-improves + survives a datacenter loss" | Dream-weaver innovation (only us) |

### 3.2 The "pain-point" we own
**"An agent whose memory goes offline doesn't degrade gracefully — it stops."**
Every judge has felt this. Our entire story is built so they *understand* it before we even say CockroachDB. This is our red thread.

### 3.3 The uncomfortable truth we lean into
The benchmark (spec §7) shows the app language is irrelevant at single-node. We communicate it head on: "The only thing that matters is that the *memory layer* is distributed, even today. That's why we built it on CockroachDB."

(This one framing is unusually strong: judges *who pass a benchmark test* love the "language doesn't matter" but the DB does — credibility.)

---

## 4. Onboarding Is the Demo, Demo Is the Video

**Primary insight from our earlier discussion:** the 3-min video *is* your onboarding. A hackathon demo is a live onboarding flow. We optimize for: **[(10-second reveal)] → [(30-second use case)] → [(70-second engineering payoffs)].

The arc (users' fee, in order):

```
1. "It remembers."  (CLI command → search, instant recall)      [10s]
2. "It can act."    (agent runs, asks phone-approval, state card) [40s]
3. "It's real."     (kill the node → memory survives)           [90s]
4. "It self-ops."   (ccloud CLI / backup / RBAC)               [20s]
5. "Never forgets." (close on the one-liner)                     [<1s]
```

---

## 5. The Product Ladder (Onion of Scope)

Everything is a wedge into the next. This prevents the classic 2-week, all-or-nothing one:

- **L0 — Front door:** Landing page + demo CLI. (Onboarding shell.)
- **L1 — CORE (Non-negotiable):** Capture→Embed→Store→Recall in CockroachDB. *This is the memory.*
- **L2 — Agent layer (High-value):** Agent acts on memory; approval push; Live Activity state machine.
- **L3 — Product layer:** Hooks API + multi-request + Idempotency + DLQ + provider interface (PWA/ExpFCM).
- **L4 — Differentiation:** CDC → SNS → push pipeline; dream-wcare consolidation; ccloud self-management; MCP read-only introspect.

**Prioritiesnaling decision:** If time dies at L2, we STILL have a winning memory + recall + an agent acting. Do NOT lose L1.

---

## 6. 15-Day Execution Plan (Gantt-style, days to Aug 18)

### Phase 0: Foundation (Days 1–2)
- [ ] Set up GitHub repo (public, MIT license) with README, structure (`src/`, `tests/`, `docs/`)
- [ ] CokDB Cloud cluster (GLOBAL multi-node) provisioned via **ccloud CLI** (JSON-out, RBAC)
- [ ] Schema migration: the full `DEVELOPER_SPEC.md` §4 model, applied
- [ ] Pick naming: candidate final name
- [ ] Create the 10-second "one command → recall" recording ASAP (validate the hook early)

### Phase 1: Core Loop (Days 3–6) — L1 + L2
- [ ] API service (Node/fastify+pg): API, validator, idempotency
- [ ] CLI: `cortex save` / `cortex ask "..."`→ write + embed + recall (atomic write into CockroachDB)
- [ ] Embeddings via Bedrock (Claude/Titan) → `memory_embeddings`; HNSW index; search endpoint
- [ ] Inbox web app (MVP push surface)
- *Gate: capture → recall works end-to-end within 5 minutes of demo time.*

### Phase 2: Product & Resilient (Days 7–11)
- [ ] Activity API + Live Activity state machine (start/update/end, sequence, `replace`)
- [ ] Approvals with callback & correlation
- [ ] CDC changefeed → SNS → SQS → Lambda fanout → provider
- [ ] Batch of integrations: crypto app + CLI + (2) - a deploy/CI example
- *Gate: "kill the node, activity survives, clients recall it."*

### Phase 3: Differentiation (Days 12–13)
- [ ] DreamWeaver worker (surprise-scoring + patterns); analytics endpoint
- [ ] ccloud self-management agent (backup, RBAC, audit) for the video
- [ ] MCP server connection for agent introspection
- *Gate: all four toolkits demonstrably in-use.*

### Phase 4: Shippable (Day 14 → deadline evening Aug 18)
No new features — hardening + packaging:
- [ ] Benchmarks vs multi-node; paste true numbers into README
- [ ] Architectural diagram (Mermaid in repo + an image)
- [ ] 3-min video: record, publish (YouTube), add to submission
- [ ] Demo URL live (deployed), public repo, license detected
- [ ] Rehearse 3× live; check the node-kill demo works offline, in the field
- [ ] Submit: all artifacts, tool list, AWS list

### Continuous, throughout:
- Video SLO: >*every deliverable step gets a 5-second screen grab for the video archive* (never run out of B-roll)
- Rehearse the demo live with a fresh CockroachDB cluster **before** recording.

---

## 7. The Demo Video — Shot-by-Shot Plan (the HIGHEST-leverage asset)

**Duration:** < 3:00. **Feel:** edits on *results*, not steps. **Host:** on terminal + phone + one slide each.

| Time | Scene | On-screen/memory | Voice helper |
|---|---|---|---|
| 0:00–0:20 | Captures/recalls | Terminal: `cortex capture "..."` → `cortex ask "how did I..."` → result in ms with similarity | "One command; it remembers your work." |
| 0:20–0:55 | Agent approval | `cortex ask --approval`, deploy request, phone shows Approve/Deny Live card, progress advances | "The agent respects it; it checks with you." |
| 0:55–1:30 | Memory / search | `GET /api/memory/search?q=deploy 184 ` → recalls prior deployment + outcome; dream solver surfaces a pattern | "It looks up its past. It learned." |
| 1:30–2:20 | Resilience | Kill node screen (cockroach quit / fail), phone card visible; node back, same event, recall intact | "An agent's memory down = it stops. Ours never." |
| 2:20–2:50 | Self-ops | ccloud CLI backup + RBAC | "It runs its own memory." |
| 2:50–3:00 | Close | Logo + one line | "Memory is the product. Built on CockroachDB + AWS." |

**The one-shot critical insurance:** *Pre-record* the kill-the-node scene; never attempt it cold on submission day. Have a redundant recording and a live fallback.

---

## 8. Resource & Team Plan (Assumptions)

- **Solo/1–2 engineers** (adjust the Gantt if 2 engineers → parallelize Phase 1 API + CLI).
- **Languages:** TS/Node (spec decision). Rust is optional (perf B.OLOG).
- **AWS:** Bedrock for embeddings/LMM + SNS/SQS/Lambda/S3. Free tiers cover demo volumes.
- **CockroachDB Cloud:** free/free Tier plugin, GLOBAL multi-node.


## 9. Stakeholders's the work upfront:
- If solo: **watch the demo** performance; prioritize L1+L2; cut polish gracefully, never core.
- Deploy-perfectly, or the *submission* (repo+video+demo) is what's judged — not source elegance.

**Important (Devpost) checklist for submission (last day):**
- [ ] Public repo (repo visible) + detectable license (MIT) in the "About"
- [ ] Functional demo URL
- [ ] Video < 3min, public YouTube/Vimeo URL
- [ ] Document which Cockroach tools (MCP, ccloud, vector, skills) and HOW
- [ ] Document which AWS (Bedrock, Lambda, S3, SNS/SQS) and HOW
- [ ] Optional arch diagram, optional eedback

---

## 11. Definition of "done+" (the two-week winning target)

A demo that — in <3 minutes — makes a stranger person say:
> "Oh — so this thing remembers, and it's the agent's memory that survives a failure. I want to use it."

Plus, on paper:
- All **4 Cockroach tool** + **≥1 AWS** (we'll exceed: 5-6 services)
- Correct, atomic, vector, changefeeds, MCP, ccloud usage
- Measured benchmark numbers (multi-node)
- Clear packaging + public repo + video + demo
- A short 'feedback for Cockroach Labs' is a nice-to-have

---

## 12. Immediate Next Actions (wet-edge)

1. Create GitHub repo + MIT + shell scaffold (`docs/`, `src/`, `tests/`).
2. Provision a CockroachDB Cloud multi-node cluster via **ccloud CLI** — also starts the "self-ops" video content for free.
3. Get the **10-second command→recall** Proto into Bedrock embedding + search.
4. Write the mock 10-sec video, post anywhere, show it to people, iterate *before* building more.

---

*Source docs: [`DEVELOPER_SPEC.md`](./DEVELOPER_SPEC.md) (tech), this plan (strategy).*