# CommonMind — About the project

> **Devpost submission copy.** This file is the single source of truth for the
> Devpost **About** field. It uses every Markdown feature Devpost supports:
> tables, footnotes, task lists, definition lists, strikethrough, highlight,
> subscript/superscript, emoji, and LaTeX inline + display math. Copy it into
> the "About the project" field verbatim.

---

## Inspiration

We watched agents fail in a way no one had a word for yet.

An agent would spend forty minutes learning the auth quirks of our codebase, then start tomorrow knowing nothing. That's the failure everyone talks about — lost context. But the one nobody talked about was worse: the agent that did real work, produced a flood of events, and *no human ever found out*. When it finally needed a decision — "should I deploy this?" — it had no channel that carried enough context for a person to answer well, and no way to remember the answer next time.

We noticed both failures are actually one failure. If the memory is genuinely shared between humans and agents, then the human's decision isn't an interrupt — it's just another memory the agent recalls next time. Every product we'd seen treated memory as a bolt-on: a vector store next to an app, a RAG wrapper, a session cache. The hackathon challenge — *agents that think, act, and remember, reliably, globally, at any scale* — was exactly the problem we wanted to build for: **memory as the product, not an afterthought.**

## What it does

**CommonMind is shared memory for humans and agents** — transactional, distributed, and engineered not to go down. One memory core, four unrelated products prove it isn't a feature.

The core loop is **capture → recall → act (with human approval) → improve**:

1. **Capture** — an agent or person records what happened. The row *and* its embedding commit in one CockroachDB transaction.
2. **Recall** — semantic search over everything captured, via CockroachDB's C-SPANN vector index. Milliseconds, in-database.
3. **Act** — the agent does safe work autonomously and stops for a human on consequential decisions. A push is a *doorbell, not a notice*: the human asks back, redirects, and decides — and the exchange itself becomes memory.
4. **Improve** — a background consolidation worker scores novelty and reorganises memory so recall measurably gets better over time.

Concretely, on a Solana trading bot running on a Raspberry Pi over Tailscale, CommonMind records every trade's rationale, answers "why did we buy this in March?" in milliseconds, pings the owner's phone before a risky entry, and keeps its context when a database node is killed on camera.

### What it is not

- ~~A RAG wrapper~~ — not a vector store bolted onto a chat app
- ~~A notification service~~ — not a pager with a database in front of it
- ~~A cache~~ — CockroachDB is the system of record, not a cache in front of one

## How we built it

**The invariant that held everything together:** *a memory record and its embedding commit in the same transaction.* Every design decision defers to it:

$$
\text{txn} \left( \text{INSERT } \texttt{memory\_records};\; \text{INSERT } \texttt{memory\_embeddings} \right) \Rightarrow \text{atomic} \wedge \text{retrievable}
$$

There is no window where something happened but isn't yet retrievable. No consumer — consolidation worker, CDC pipeline, human — can observe a half-written memory. A PR that splits these writes is wrong regardless of how fast it is.

### The stack, chosen to remove infrastructure rather than add it

| Layer | Choice | Why |
|---|---|---|
| **Memory** | CockroachDB (serverless, on AWS) | Global, always-on, transactional **and** vector in one store |
| **Recall** | C-SPANN over `VECTOR(1024)` | New vectors searchable immediately — no rebuild, no HNSW graph to shard |
| **Embeddings** | Amazon Bedrock — Titan Text Embeddings V2 | Retrieval-optimised, $0.02 / M input tokens |
| **Compute** | AWS Lambda + Function URLs | Serverless agent execution, scales to zero |
| **Event source** | CockroachDB changefeed → SNS → SQS + DLQ | **The commit is the event** — no outbox, no dual-write bug |
| **Artifacts** | Amazon S3 | Snapshots and runbook sources off the hot path |

### Request paths

| Path | Flow |
|---|---|
| **Capture** | agent → Lambda → Bedrock (embed) → CockroachDB (one txn) → changefeed → SNS → SQS → Lambda fanout → push |
| **Recall** | agent → Lambda → Bedrock (embed query) → C-SPANN search → joined rows → agent |
| **Approve** | agent requests → notification row commits → push → human decides → decision commits as new memory → agent resumes with it |

## Challenges we ran into

1. **CockroachDB is not Postgres.** Our first vector index used `USING hnsw (...)`. It failed — CockroachDB doesn't implement HNSW at all; it uses C-SPANN and wants `CREATE VECTOR INDEX ... USING vector_cosine_ops`. "It's Postgres compatible" made the wrong answer look right. We wrote the rule down: *Postgres is a useful prior, never an authority.* The CockroachDB doc wins.
2. **The vector dimension was wrong.** The schema originally said `VECTOR(768)` — a dimension no Bedrock model actually emits. We moved to **Titan v2's native 1024**, and it changed downstream: index size, cost math, embedding calls.
3. **Sequential PKs are a hotspot.** `memory_events` is our hottest write path; `BIGSERIAL` funnels every insert into one range. We use `unique_rowid()` so the load shards across ranges — a system that only claims to scale isn't the same as one that does.
4. **The database is the event source.** The temptation was a queue-first design. We rejected it: publishing to a queue from app code reintroduces the dual-write problem. CDC off the committed row makes that bug class *unrepresentable*.
5. **SNS alone loses pushes.** A Lambda subscribed directly to SNS has no retry buffer — one failed push becomes a permanently lost notification. SQS + DLQ between them was non-negotiable.
6. **It passed on every machine — except the one that mattered.** `npm test` was green on our Node 22 dev machines but silently failed on Node 20: `node --test` with a quoted glob can't expand the pattern, and glob support only landed in Node 21/22. Meanwhile `package.json` declared `"node": ">=20"`, so a Node 20 user was told their environment was supported when it wasn't. The fix was one line — unquote the glob so the shell expands it, which works on both versions without forcing anyone to upgrade. It taught us why the "passes on a clean clone" checklist item exists: **an environment difference isn't a bug in the user's setup, it's a bug in your claim about your own project.**

## Accomplishments that we're proud of

- [x] **The atomic-write invariant**, stated as a hard rule every PR is judged against
- [x] **One shared memory, four working products** — a trading bot on real Raspberry Pi hardware, dev-team coding sessions, a marketing agency's per-client brain, and a game where the creature remembers you
- [x] **A doorbell, not a pager.** Humans get exactly three classes of push — Silent, Alert, Priority — and the decision thread persists *in the same memory layer* as everything else
- [x] **Honest resilience.** Every range is replicated 3× and coordinated by Raft — lose the leaseholder and the cluster re-elects in seconds, no operator
- [x] **Zero idle cost.** Bedrock + Lambda + SNS/SQS + S3 + CockroachDB all scale to zero

## What we learned

term
: **The human is not a failure mode**
   A decision isn't an interrupt to be handled — it's data to be remembered. The exchange becomes memory the agent recalls next time.

term
: **Failing closed beats failing stale**
   An agent told "memory unavailable" is safer than one told something that was true ten minutes ago. We would rather error than mislead. ^[Stale memory acted on with full confidence is worse than an error — the README's "why this database" section spells this out.]

term
: **Durability must never depend on the delivery path**
   A push can fail, retry, or dead-letter and the memory is still correct — it was committed before anything downstream knew it existed.

term
: **One measured number beats five aspirational ones**
   A claim a judge can't reproduce on demand is a claim a judge can dismantle. ==Performance figures get benchmarked or cut.==

### The resilience math, stated precisely

"Never goes down" is marketing. This is the engineering:

| Property | Guarantee |
|---|---|
| Replication | every range replicated **3×** by default |
| Consensus | **Raft** — a write commits once a **majority** of replicas acknowledge |
| Survivable failures | **(RF − 1) ÷ 2** → 3× survives **one** node; 5× survives **two** |
| Under partition | **CP** — below quorum, a range goes *unavailable* rather than serving stale data |
| Isolation | **Serializable** by default |

Replication factor three means a single node loss leaves a live quorum:

$$
\text{quorum}(RF{=}3) = \left\lfloor \tfrac{3}{2} \right\rfloor + 1 = 2 \quad\Rightarrow\quad \text{kill 1 node} \Rightarrow \text{memory survives}
$$

Vector recall is cosine similarity over the embedding: the recall rank is the same whether you measure in the database or end-to-end, but the *latency* differs:

$$ \text{similarity}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \cdot \lVert b \rVert_2} \in [-1, 1] $$

We picked **Titan v2 at 1024-dim** over the alternatives:

| Model | Dims | Verdict |
|---|---|---|
| **Titan v2 (default)** | **1024** | ✅ retrieval-optimised; **$0.02 / M input tokens** |
| Titan v2 (reduced) | 512 / 256 | Matryoshka truncations ~99% / ~97% recall — after submission |
| Titan v1 | 1536 | ❌ 5× the token price, ~33% larger index |

## Links

- **Source code:** https://github.com/LandCruiserWorld/commonmind
- **Live demo:** https://commonmind.agent9.dev
- **Architecture diagram:** `assets/images/aws-serverless-architecture.svg` in the repo
- **License:** Apache-2.0

> Footnote ^[This file is mirrored in the repo as `docs/DEVPOST_ABOUT.md` so the submission text and the repository never drift.]

---

*CommonMind — shared memory for humans and agents. Transactional, distributed, built on CockroachDB and AWS serverless.*
