# MASTER DEVELOPER DOCUMENT — "The Cortex"
### A brain for your company that never forgets — and never quits.
**Project:** CockroachDB × AWS Hackathon — Build with Agentic Memory
**Deadline:** Aug 18, 2026 @ 5:00 PM EDT · **Plan start:** Mon Aug 3, 2026
**Companion docs:** `DEVELOPER_SPEC.md` (technical detail) · `STRATEGIC_PLAN.md` (win-strategy)

---

## PART 1 — THE WHY (frame everything from here)

### 1.1 The one truth we sell

> **The most expensive thing a business owns is what its people know — and it walks out the door every Friday.**

An engineer quits → months of context leave with them. "Who knows why this works?" → nobody. 3am, something breaks → the person who fixed it before isn't there. Regulators ask "what happened?" → no one can replay it.

Our product answers one sentence: **"Never lose the thing your people know, and never make them repeat it."** A brain that stays, gets better, and operates when people can't.

### 1.2 The product one-liner

> **"A brain for your company that never forgets — and never quits."**

Alternate framings per audience:
- **Everyone:** "A brain for your company that never forgets — and never quits."
- **Ops/SRE:** "When the person who knows is gone, the knowledge stays."
- **Onboarding:** "New hires get years of experience in their first week."
- **Future/agents:** "Trustworthy shared memory for the agents doing your real work."
- **Plain:** "Knowledge that survives your team."

### 1.3 Who this is actually useful to

| Audience | The pain | Why they buy | Urgency |
|---|---|---|---|
| **Ops-heavy teams** (incident response, 24/7) | Knowledge of "what worked before" is life-or-death; the fix is lost with the person who knew | Agent recalls the last incident, applies the runbook, pings the right human | **Highest-value, most urgent buyer** |
| **Agencies / SMBs** | Lose one dev and you're cooked; turnover hits hardest | Institutional knowledge survives turnover; onboarding days→weeks | Immediate, visceral |
| **Regulated / audited industries** (fintech, health, compliance) | Must prove history; no audit trail for agent actions | Every action is transactional, replayable, provable | Mandatory, budget-backed |
| **Any business running AI agents** | Agents doing real work need trustworthy shared memory | Shared, auditable memory = the wedge into the agentic future | Strategic, growing |

### 1.4 The pains it kills (value, not features)

1. **Turnover / single point of failure** — the departing engineer's knowledge keeps working.
2. **Slow onboarding** — new hires ask the system, not the person who "just knows." Weeks → days.
3. **Repeat mistakes / reinventing** — "we solved this before" + the fix that worked; a visible learning curve.
4. **Overnight failures** — when no human is awake, the remembering agent keeps working and pings you.
5. **Accountability** — regulators/managers/customers ask "what did your system do?" → everything replays.
6. **Decisions in transit** — it checks with a human before risky actions; approve on your phone, the knowledge never sleeps.

### 1.5 The narrative frame (used by every asset)

Humanize one asset = "a person's knowledge leaving." The story arc:
1. **The moment of fear** — "We're down at 2am and the only person who knows is late."
2. **The system already knew** — it remembers the last time, finds the fix, asks you to approve, works.
3. **The proof it's valuable** — new hires onboard in days; nothing is lost when someone leaves.
4. **The closing line** — "The person knew... was already gone. The knowledge wasn't."

### 1.6 The agentic future — the trust layer (where this is headed)

> **The future of work is agents. Someone has to be in charge — and know what they did. That's us.**

As agents do more of the actual work, capability stops being the scarce thing. The scarce thing becomes **trust and control**: knowing what your agents are doing, approving the risky actions, and being alerted the moment one needs a human. A company running 50 agents doesn't need a better agent — it needs a control surface over the ones it has.

**The reframe:** our notifications are not "push alerts." They are **the human control surface for the agent workforce** — an activity stream that is human-reviewable, replayable, and provable. One feature, two stories:
1. **The trust/control surface** (future of work) — what agents are doing, right now, on your phone.
2. **The accountability/audit trail** (production readiness) — everything the swarm did, replayable.

**Our stance — "human decides, agent executes":** the Operator agent runs free on safe work and hands every consequential decision to a person through the phone. That is responsible automation — genuinely differentiated from the "agents run wild" crowd, and exactly what a business-facing judge nods at.

**How the demo gets in front of the trend (no new scope):**
- Show a **swarm of agents** (three Operators, e.g. one per AWS region) sharing one CockroachDB memory — the future-of-work picture, leveraging global replication harder than any single-agent demo.
- The activity/approval feed becomes **"the dashboard for what your agents are doing"** in the video, not "push alerts."
- Close on the future line: *"The future of work is agents. Someone has to be in charge — and know what they did. That's us."*

---

## PART 2 — THE WHAT

### 2.1 What we're building (product definition)

**The Cortex** is a webhook → agent → phone platform where **CockroachDB is the transactional, globally-replicated, self-improving memory layer**. It captures knowledge (from people, CLIs, agents, and incident events), makes it instantly recallable, lets agents act on it (with human approval), and never loses it — even if a datacenter dies.

Three surfaces, one memory core:
1. **Capture — Terminal CLI** (the wedge): `cortex capture "fixed auth timeout"` → session stored + embedded.
2. **Explore — Web/App**: semantic search of captured knowledge ("how did I fix the auth timeout?").
3. **Act — Agent + approvals**: agents read/write the same memory, request phone approval, drive Live Activities.

The ladder: **capture → recall → act**. Each step makes the next obvious and shows where it integrates easiest (anywhere there's a CLI: CI, cron, on-call, git hooks).

### 2.2 The thesis that wins the hackathon

> **An agent whose memory goes offline doesn't degrade gracefully — it stops. Our memory is the product: every notification, approval, and Live Activity is a transaction in CockroachDB. Kill the node, memory survives.**

What makes it novel vs. a plain Hark clone:
1. **Memory is the source of truth** — CDC changefeeds off the DB drive the push pipeline.
2. **Self-improving consolidation** — background "dream-weaver" agents (Titans/Miras surprise scoring) reorganize memory so agents get measurably better.
3. **Resilience as the demo** — kill the CockroachDB node live; activities survive and keep updating.
4. **All 4 CockroachDB tools + AWS used deeply** — not ticked for compliance.

### 2.3 Requirements compliance

| CockroachDB Tool | How we use it |
|---|---|
| **Distributed Vector Indexing** | Semantic recall; surprise scoring for dream-weavers; multi-factor retrieval |
| **Managed MCP Server** | Agents/humans introspect the Cortex read-only, safely, with audit logging |
| **ccloud CLI (agent-ready)** | A "memory ops agent" provisions clusters, takes backups, configures RBAC autonomously |
| **Agent Skills Repo** | We package our own skills (`cortex-query`, `cortex-approve`, `cortex-consolidate`) |
| **Changefeeds (CDC)** *(bonus)* | The transactional event stream driving SNS → push. Our differentiator |

| AWS Service | How we use it |
|---|---|
| **Amazon SNS** | Fanout of CDC events → push pipeline, retries, DLQ |
| **AWS Lambda** | Push fanout worker, CDC→SNS bridge, dream-weaver workers, API handlers |
| **Amazon S3** | Avatars/images, artifact storage (runbooks, incident attachments) |
| **Amazon Bedrock** | LLM reasoning (rich push copy), embeddings for vector indexing |
| **Amazon ECS/EKS** *(optional)* | Persistent API if Lambda cold starts hurt the live demo |

---

## PART 2.5 — THE AGENTS (the core of the story — read this first)

The hackathon theme is **"Agents that think. Agents that act. Agents that remember."** Most submissions will build a RAG chatbot and call it agentic. We build *three working agents* that each use the CrockDB memory layer for a genuinely different reason. This is what separates us — the agents are the product, and memory is the thing that makes each one work.

### 2.5.1 The three agents we ship

| Agent | What it does | The memory it relies on | The CockroachDB tool it proves |
|---|---|---|---|
| **The Memory Agent** (the user's "second brain") | Captures dev/ops knowledge automatically via CLI hooks; answers any past question in ms | Semantic recall of everything it ever captured — atomic row+embedding | **Distributed Vector Indexing** |
| **The Operator Agent** (24/7 responder) | Watches an event stream; when something breaks it recalls the last incident, applies the runbook, **asks a human on their phone** before risky action | Transactional state + approval machine + past incident vectors | **Changefeeds (CDC) → SNS → AWS Lambda** |
| **The Dream-Weaver** (the Minder) | Background agent that **consolidates** memory — scores surprise, extracts patterns, compresses, so memories self-improve | The whole corpus, reorganized in background transactions | **MCP Server + Agent Skills Repo + ccloud CLI** |

Together they form the loop: **capture (Memory) → recall (Memory) → act (Operator) → improve (Dream-Weaver).** That loop is the "agentic memory" the judges will look for.

### 2.5.2 Why this reads as "agentic" and not "a database product"

Judges check *Agentic Memory Design*: is memory used for more than toy queries — state, embeddings, context, transactional data at scale? Our answer, demonstrated the code:

- **State** — every approval and Live Activity is a transaction (the state machine lives in CockroachDB, not in the app).
- **Embeddings** — memory_embeddings HNSW index for semantic recall.
- **Context** — an agent's next action is decided by vector similarity to its own past.
- **Transactional history** — events replayable for audit and that self-improving learning curve.

So memory is *the reason each agent can do its job*, which is exactly the criterion.

### 2.5.3 The hackage that makes capture automatic (the differentiator)

Capture being manual kills adoption. We make it automatic using **agent CLI hooks** — the same pattern Hark's `harkctl permissions` uses. `cortex init` drops a hook into your dev CLI:

```json
{
  "hooks": {
    "SessionStop": [{"hooks":[{"type":"command","command":"cortex capture --from-hook"}]}],
    "SessionStart": [{"hooks":[{"type":"command","command":"cortex inject --project"}]}]
  }
}
```

- On **SessionStop**, `cortex capture --from-hook` reads the session transcript (Claude Code passes it on stdin), distills the decisions/gotchas with an LLM, and writes them atomically into CockroachDB. The agent **remembers on its own** — zero user effort.
- On **SessionStart**, `cortex inject --project` pulls that memory back into the agent's context — so the agent *starts already knowing*: *"Last session you fixed the auth timeout; the migration is pending."*

Same hook scripts install into **Claude Code, Codex, and opencode**. This is the "never forgets, never quits" story literally wiring into the developer's daily tool, and it's an unforgettable 10-second demo beat.

### 2.5.3b The MCP server — the universal adapter (solves "per-app plugins")

CockroachDB's **Managed MCP Server** is our answer to "does every employee's Claude/Cursor/Codex need its own plugin?" **No — they all speak MCP natively, so one Cortex MCP server covers them all.** We ship one MCP server that any MCP-capable tool (Claude Code, Cursor, Codex CLI, opencode, Copilot, any future agent) exposes directly, instead of per-app plugins:

```
cortex serve-mcp            # runs the MCP server: stdio + HTTP/SSE
cortex connect <cli>        # 1) registered the tool with the CLI  OR
                            # 2) dropped native hooks where the CLI supports them (Claude Code, opencode)
```

The MCP server exposes a small, consistent tool surface — **capture, recall, ask, approve/pause, note** — so an agent's memory interactions are identical across tools:

- `memory.capture` — record a decision/gotcha/result atomically (row + embedding, one txn).
- `memory.recall` — semantic vector recall against the corpus, with source + thread.
- `memory.ask` / `memory.approve` — hand control back to a human; approval state machine lives in CockroachDB (survives an agent/crash restart).
- `memory.note` — contribute a public/private note to the company brain.

This is the "bake it into the plan" reconciliation: **no per-app plugins**. One MCP server + a per-app `docs/agents/` guide (`AGENTS.md`/`SKILL.md` that tells the agent the MCP tool surface to call) + native hooks where the CLI supports them. Everyone adapts via the one standard every agent already speaks.

### 2.5.4 The human-in-the-loop story (what separates a real agent from a script)

A truly scary agent just acts on its own; a useless one needs to be babysat. Our answer: **the Operator agent is fully autonomous for safe actions and stops for approval on risky ones — and that approval lands on the human's phone as a Live Activity they can act on in seconds.** The DB stores the approval state machine, so the decision is not lost if the agent process dies. This is production-grade agent behavior, and judges reward exactly that.

### 2.5.5 The "self-improving" memory (the genuinely novel agent)

The Dream-Weaver is our creativity point. No one else will show a memory that *gets better on its own* — that's a learning curve to a demo. It:
1. Scores how *surprising* (novel informative) each new memory is vs. the corpus (Titans/Miras-style),
2. Extracts patterns ("deploys after 22:00 fail ~40% more often"),
3. Compresses the routine, highlights the insightful, and consolidates atomically,
4. Documents the way for the Operator agent.

The demo shows a before/after recall curve — *the same question answered better over time because the memory improved.* That is the "creativity & originality" and "agentic memory design" boxes from the judging criteria, both crossed at once.

---

## PART 3 — THE ARCHITECTURE & DATA (summary; full detail in `DEVELOPER_SPEC.md`)

### 3.1 Flow

```
webhook / CLI → API (Lambda/ECS) → CockroachDB (memory cortex)
                                      │ atomic write: row + embedding
                                      ▼
                         CDC changefeed → SNS → SQS → Lambda fanout
                                                      ▼
                                    PushProvider (inbox-web / FCM / APNs-Expo)
                                                      ▼
                                                 phone / web
```

Agents coordinate by **writing and reading the Cortex** — the transactional memory log doubles as the coordination bus. Every memory write is atomic (operational row + embedding in one transaction).

### 3.2 Core tables (CockroachDB)

- `services` — webhook integrations (title, avatar, tap_url, webhook_token)
- `devices` — push targets (inbox / fcm / apns)
- `notifications` — one-shot pushes + approval state machine + idempotency key
- `live_activities` — stateful lock-screen cards (start/update/end, sequence, replace)
- `memory_embeddings` — VECTOR(768), HNSW index, for semantic recall
- `memory_consolidations` — dream-weaver outputs (patterns, surprise, digests)
- `memory_events` — audit/event log; the changefeed source

### 3.3 API surface (v1)

- `POST /hooks/:token` — one-shot push (body required; optional response=approval/yes_no/text)
- `GET /hooks/:token/events/:eventId`, `POST .../cancel` — interactive responses
- `POST /hooks/:token/live-activities` + `GET/PATCH/:id` + `POST/:id/end` — Live Activities
- `GET /api/memory/search?q=...` — semantic recall (our differentiator)
- `GET /api/memory/patterns`, `/api/memory/analytics`, `/api/memory/surprise-analysis`
- `GET /api/consolidation/weekly` — what agents did this week

### 3.4 Pluggable PushProvider

```ts
interface PushProvider {
  send(notification, device): Promise<DeliveryResult>;
  startActivity(activity, device): Promise<DeliveryResult>;
  updateActivity(activity, device): Promise<DeliveryResult>;
  endActivity(activity, device): Promise<DeliveryResult>;
}
```
- `InboxProvider` — web app inbox/PWA; **MVP default** (zero store/cert cost)
- `FcmProvider` — Android native (sideloaded APK)
- `ExpoApnsProvider` — iOS lock screen + Live Activities (stretch; TestFlight)

### 3.5 Benchmark decision (locked)

Local single-node measured: Node ~1,151–2,334 ops/s; Rust ~1,273–1,712 ops/s — both bottleneck on the DB write path. **Language = developer velocity, not performance → ship TypeScript.** Rust optional only for a cold-start/binary-size README note. Run the fixture against a real multi-node GLOBAL cluster for headline numbers.

---

## PART 4 — THE PLAN TO DEADLINE (Aug 3 → Aug 18)

**Rules of the plan:** (1) The demo/video is the product — it is the onboarding. (2) Don't lose the wedge (capture→recall). (3) Rehearse the kill-the-node scene before recording. (4) Every deliverable gets a 5-second screen grab for the video archive. (5) Freeze features by Day 14; days 14–15 are packaging + rehearsal.

### Week 1 — Core loop (Aug 3 Sun–Aug 9 Sun)

| Day | Focus | Deliverables | Exit gate |
|---|---|---|---|
| **Mon Aug 3** | Foundation | GitHub repo (public, MIT, in About); `create-cortex` scaffold (`src/`, `tests/`, `docs/`); final project name; local CockroachDB dev-mode bootstrap script | `npx create-cortex` runs + launches local DB |
| **Tue Aug 4** | Wedge | CLI: `cortex capture`, `cortex ask` (write + embed + recall); schema migrated (core tables); atomic-write helper | Capture→recall works in <5 min of demo time |
| **Wed Aug 5** | Wedge → web | Inbox web app (MVP); `/api/memory/search`; embedding provider toggle (local/Bedrock) | Search from web UI recalls CLI-captured memories |
| **Thu Aug 6** | Act | Notifications API + approvals + idempotency; CLI `cortex approve`; approval callback | Approval flow round-trips (send→approve→callback) |
| **Fri Aug 7** | Act | Live Activities state machine (start/update/end, sequence, replace) | Activity lifecycle drives end-to-end |
| **Sat Aug 8** | Resilience | CDC changefeed → SNS → SQS → Lambda fanout → provider | Push fires off a DB event (kill/restart node = no loss) |
| **Sun Aug 9** | Week-1 review | 10-sec hook video (command→recall) recorded + shared; integration demo (crypto app or CI) wired | "Oh cool" reaction confirmed by a stranger |

### Week 2 — Differentiation + polish (Aug 10 Sun–Aug 16 Sun)

| Day | Focus | Deliverables | Exit gate |
|---|---|---|---|
| **Mon Aug 10** | Memory | Dream-weaver consolidation (surprise scoring + patterns); `/api/memory/patterns`, `/analytics`, `/consolidation/weekly` | Agent visibly "gets better" (learning curve data) |
| **Tue Aug 11** | Self-ops | ccloud memory-ops agent (provision/backup/RBAC, JSON-out); **Cortex MCP server** (capture/recall/ask/approve/note) + `docs/agents/` guide files | ccloud + MCP demonstrably in use in video; Claude + Cursor both recall the same memory |
| **Wed Aug 12** | Integrations | 2+ real integrations (crypto app, CI/deploy, on-call sim); Landing page copy from Part 1 narrative | Landing page tells the "knowledge that quits" story |
| **Thu Aug 13** | Bench + docs | Multi-node benchmark run; README with real numbers + arch diagram + MIT license | Repo reads like a product, not a prototype |
| **Fri Aug 14** | Video shoot | Full 3-min video recorded on new cluster; B-roll archive; kill-the-node scene recorded (with fallback) | Video cut in progress, <3:00 |
| **Sat Aug 15** | Video + rehearsal | Video final cut (YouTube public); 3× live rehearsal incl. kill-the-node | Demo runs clean twice in a row |
| **Sun Aug 16** | Freeze | Feature freeze. No new features. Fix only demo-blocking bugs | Repo, demo URL, video all stable |

### Final days (Aug 17–Aug 18)

| Day | Focus | Deliverables |
|---|---|---|
| **Mon Aug 17** | Packaging | Submit draft: repo link (license visible), demo URL live, video URL, tool/AWS usage list, arch diagram; dry-run the whole submission form |
| **Tue Aug 18** | SUBMIT | Final submit **before 5:00 PM EDT** (early!). Buffer for form/upload hiccups. Post-submit: optional Cockroach Labs feedback note |

### The submission checklist (Devpost)

- [ ] Public repo, MIT license detectable in the About section
- [ ] Functional demo URL
- [ ] Video < 3 min, public YouTube/Vimeo
- [ ] Which CockroachDB tools used (MCP, ccloud, vector, skills) + HOW the agent used them
- [ ] Which AWS services used (Bedrock, Lambda, S3, SNS/SQS) + HOW
- [ ] Optional: architecture diagram + feedback for Cockroach Labs

### Video shot-list (the highest-leverage asset)

| Time | Scene | Story beat |
|---|---|---|
| 0:00–0:20 | Capture→recall | "One command; it remembers your work." |
| 0:20–0:55 | Agent approval | "The agent checks with you before it acts." |
| 0:55–1:30 | Memory/search + learning | "It looks up its past. It learned." |
| 1:30–2:20 | **Kill the node** | "An agent's memory down = it stops. Ours never." Swarm of 3 Operator agents (one per region) keep coordinating through one CockroachDB brain while a node dies |
| 2:20–2:50 | Self-ops (ccloud) | "It runs its own memory." |
| 2:50–3:00 | Close | "A brain for your company that never forgets — and never quits. The future of work is agents. Someone has to be in charge — and know what they did. That's us." |

---

## PART 5 — RISKS & OPEN DECISIONS

| Risk | Impact | Mitigation |
|---|---|---|
| Live Activities APNs is fiddly (entitlement, push-to-start) | High | Inbox/PWA is MVP surface; native = stretch. Screenshot a native phone for video |
| Free tier limits | Medium | Benchmark locally; demo on Cloud at modest volumes |
| Scope creep in Week 2 | High | Freeze at Sun Aug 16; kill-the-node + recall are untouchable |
| 3-min video overruns | Medium | Storyboard; trim self-ops if needed |
| Demo breaks at submission | High | Pre-record kill-the-node + rehearsal on a fresh cluster |
| "Another notification tool" perception | High | Lead every asset with the knowledge-that-quits frame, not the webhook |

**Open decisions to lock this week:**
1. Final name (Cortex / Perpetual Cortex / Dreamweaver Cortex / other)
2. Which integration to show live (crypto app is the strongest already-built evidence)
3. Demo face: ops/SRE at 3am (recommended) vs. agency turnover vs. agentic-future

---

## PART 6 — HOW WE WIN DECISIVELY (map to every judging criterion)

The official criteria are: **Agentic Memory Design, Technical Implementation, Real-World Impact, Production Readiness, Creativity & Originality.** Here is how we score top marks on *each* — and where we beat the field so badly it isn't close.

### 6.1 Agentic Memory Design — the criterion that decides 1st place
> *"Does CockroachDB play a meaningful, production-grade role? Used for more than toy queries — state, embeddings, context, or transactional data at real scale?"*

Most teams: a chatbot with a vector table bolted on. Us: **three agents whose existence depends on CockroachDB** — state (approvals, Live Activities), embeddings (recall), context (decisions from past vectors), transactional history (replayable, auditable, self-improving). Memory isn't a feature of our product; our product *is* memory. We show scale with the multi-node benchmark and CDC throughput. **Verdict: a category above.**

### 6.2 Technical Implementation
> *"Quality integration with the CockroachDB tools. Used correctly and safely."*

We use **all four** required tools + Changefeeds, each for its intended purpose: Distributed Vector Indexing (recall + surprise scoring), MCP Server (safe read-only agent introspection with audit), ccloud CLI (a self-managing memory-ops agent with JSON-out + RBAC), Agent Skills (our own `cortex-*` skills), and CDC (event streaming). Atomic writes, idempotency, DLQ, optimistic concurrency (`ifSequence`). Nothing is a compliance checkmark. **Verdict: breadth and depth the field won't match.**

### 6.3 Real-World Impact
> *"How big an impact could it have? Meaningful, not just technically impressive."*

The pains are named businesses have: turnover, 3am incidents, onboarding, auditability. We lead with *already-built integrations* (crypto-trading app, CLI, CI hooks) as evidence it works in the wild — not a hypothetical. The operator-agent use case (the highest-value, most urgent buyer) is the one people feel in their gut. **Verdict: relatable, urgent, and provably real.**

### 6.4 Production Readiness
> *"Secure, observable, scalable. Resilience, access control, what happens when things go wrong."*

This is our thesis, made visible: **kill the CockroachDB node in the demo and the memory survives.** Add idempotency keys, SNS/SQS retry + DLQ, RBAC via ccloud, audit logging via MCP, transactional approval state that survives process death, multi-region global replication. We don't just describe resilience — we record it happening. **Verdict: the most production-grade demo on the board.**

### 6.5 Creativity & Originality
> *"A genuinely new idea or novel application? Insight into what makes agentic systems different."*

Two original claims nobody else will have:
1. **Automatic capture via agent CLI hooks** — the agent remembers without being asked. A first-class, demoable onboarding wedge.
2. **Self-improving memory (Dream-Weaver)** — memory that gets measurably better over time, shown as a learning curve. Novel application of Titans/Miras thinking to a real product.

**Verdict: genuinely new, not a remix.**

### 6.6 Why it isn't close

| Where the field sits | Where we sit |
|---|---|
| One memory feature in an app | Memory as the entire product, powering three agents |
| Uses 2 required tools to qualify | Uses all 4 + CDC, each for a distinct deep purpose |
| Vector search as a demo gimmick | Vector recall that drives the operator's next action |
| "It's reliable" (claims) | Kill-the-node on camera — recorded proof |
| A RAG chatbot | Automatic capture → recall → act → self-improve loop |

The submission form also asks us to state *which* tools we used and how, and which AWS services and how — the doc's §2.3 tables give the judges the exact answer in two sentences. Give them the story in the video, and the receipts in the README/submission text.

---

## PART 7 — THE "DONE+" DEFINITION

**Win if:** a stranger watches the <3-min video and says *"Oh — it remembers, and it survives a failure. I want to use it."* Plus on paper: all 4 Cockroach tools + multiple AWS services, correct atomic/vector/changefeed/MCP/ccloud usage, measured multi-node benchmarks, clean public packaging.

**Win decisively if:** the judge can't point to a single criterion where another submission beats us — because we've mapped our demo to *every* criterion (§6), and the two things nobody else has (automatic capture, self-improving memory) are the ones they'll remember at 1st-place discussion time.

---

*Start here this week: scaffold `create-cortex` (Day 1) → capture/recall (Day 2) → record the 10-sec hook video (before anything else is pretty). Every asset speaks the one line: "A brain for your company that never forgets — and never quits."*
