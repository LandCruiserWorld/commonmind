# DREAM-WEAVER SPEC — Mon Aug 10

**What this document owns:** the design of the Dream-Weaver consolidation layer.
**What it does not own:** the date. [`CHECKLIST.md`](CHECKLIST.md) remains authoritative on scheduling — if it and this file ever disagree, the checklist wins.

Isolated into its own file deliberately. Dream-Weaver is **L4 on the cut ladder** ([`ROADMAP.md`](ROADMAP.md) §3). If it gets cut, delete this file and three one-line links — no prose surgery across four documents.

---

## 1. The deliverable is a measurement, not a feature

Read this before writing code. Monday's gate is:

> **A real learning curve — or the "improves itself" claim comes off the site.**

A working Dream-Weaver that produces no measurable recall improvement **fails this gate**. A modest, honestly-measured improvement passes it. Build the measurement harness first and the consolidation second, because the harness is what's being judged and it's what tells you whether the consolidation is worth anything.

This follows the repo's standing honesty policy: *we would rather show one measured number than five aspirational ones.*

---

## 2. Entry condition — do not start without this

**Bedrock Titan v2 must be live and `EMBED_PROVIDER=bedrock` must be set for every run in this task.**

This is a hard prerequisite, not a preference. `src/config.ts` defaults to `local`:

```ts
embedProvider: (env.EMBED_PROVIDER === 'bedrock' ? 'bedrock' : 'local')
```

`LocalEmbeddingProvider` is a signed feature-hashing sketch — tokens hashed into buckets with ±1, then L2-normalised. It is deterministic, dependency-free, and correct for offline tests. It is also **lexical, not semantic**: it measures vocabulary overlap. "Car" and "automobile" land near-orthogonal.

Every idea in this document depends on embedding distance meaning *semantic* distance. On the local provider, surprise scoring measures whether someone used unusual words, and a before/after recall curve measures nothing at all.

**Note carefully:** both providers emit exactly 1024 dimensions and both pass `validateEmbedding()`. Dimension count does not tell you which provider ran. Verify behaviourally:

```bash
commonmind capture "the database cluster lost a node during the demo"
commonmind ask "which server went down while we were presenting"
```

Bedrock returns the memory. Local returns nothing useful. Zero shared tokens is the point.

---

## 3. What Dream-Weaver is

The third agent. Invariants from `README.md` — do not break these:

| Invariant | Meaning |
|---|---|
| Runs in the background | Never in the capture or recall request path |
| Reads only committed rows | No dirty reads, no coordination with in-flight writes |
| **Never mutates source memories** | `memory_records` and `memory_embeddings` are append-only to this agent |

Consolidation writes **new derived rows**. The original memory is always still there, unchanged. This is what makes the improvement auditable — you can always show the before.

---

## 4. Surprise scoring — SETTLED: embedding distance

**Decision: surprise is cosine distance to the nearest existing memory.** Recorded here as settled; log the rationale in [`BUILD_LOG.md`](BUILD_LOG.md) when implemented.

```
surprise(m) = 1 - max(cosine_similarity(m, existing memories))
```

`MemoryRepository.recall()` already returns exactly this similarity as `score` (`1 - (m.embedding <=> $1::vector)`). So surprise scoring is roughly:

```ts
const neighbours = await repo.recall(embedding, 1);
const surprise = neighbours.length ? 1 - neighbours[0].score : 1.0;
```

A memory that lands far from everything already known *is* the novel one. That is the whole idea, and it falls out of the vector index the submission is already showcasing.

**Why this and not a weighted heuristic:** it needs no hand-tuned weights to justify to a judge, it reuses the C-SPANN index that's already the centrepiece, and it's about twenty lines. A four-component heuristic invites the question "why those weights?" and there is no good answer under demo pressure.

Classification thresholds — tune against real data, don't invent them:

| Band | Suggested range |
|---|---|
| low | < 0.25 |
| medium | 0.25 – 0.50 |
| high | 0.50 – 0.75 |
| exceptional | > 0.75 |

---

## 5. What to write

`memory_consolidations` already exists in `src/db/schema.sql` with a C-SPANN index. No migration needed.

```sql
id                UUID PRIMARY KEY
kind              STRING NOT NULL      -- 'pattern' | 'surprise' | 'digest' | 'insight'
summary           STRING NOT NULL
source_entity_ids UUID[]               -- provenance: which memories produced this
surprise_score    FLOAT
frequency         INT DEFAULT 0
recency           TIMESTAMPTZ
embedding         VECTOR(1024) NOT NULL
created_at        TIMESTAMPTZ DEFAULT now()
```

Two kinds for Monday, and only two:

- **`surprise`** — a memory scoring above the `high` threshold, summarised, with its own embedding. Cheap: one row per novel memory.
- **`pattern`** — cluster memories by embedding proximity, summarise each cluster of 3+, embed the summary. This is the row that actually improves recall, because a query can now hit a dense summary instead of missing three sparse originals.

Always populate `source_entity_ids`. Provenance is what lets you demo "this insight came from these three memories" — and it's what proves nothing was mutated.

---

## 6. The measurement — this is the graded artifact

1. **Fix a question set before running anything.** 15–20 realistic queries against the corpus, written down and committed. Do not adjust them after seeing results.
2. **Baseline:** for each query, record recall@5 from `memory_records` only.
3. **Run Dream-Weaver** over the corpus.
4. **After:** re-run the same queries with `memory_consolidations` included in the search.
5. **Report** the delta, the corpus size, the question set, and the exact commands to reproduce.

Commit the numbers and the method to [`BUILD_LOG.md`](BUILD_LOG.md). A number without a reproduction path is a number a judge can dismantle.

**If the delta is zero or negative, that is a legitimate result — and per the gate, the claim comes off the landing page.** Say so plainly rather than tuning until it looks good. A team that reports a null result and removes the claim is more credible than one that doesn't, and it's a story worth telling on camera.

---

## 7. Prior art — what to take, what to leave

`LandCruiserWorld/keendreams` has a working version of this shape. It is a **blueprint, not a dependency** — it's Cloudflare KV + Vectorize, so nothing ports line-for-line.

| File | Take |
|---|---|
| `src/keendreams-surprise-scoring.ts` (296 lines, zero imports) | The **shape**: component score → weighted combine → classify → write a row. And `classifySurpriseLevel()`. |
| `src/keendreams-consolidation.ts` (1,226 lines) | The **operational answers**: how often to run, what to write, how to avoid mutating sources. |
| `src/keendreams-patterns.ts` (652 lines) | Clustering and summarisation approach. |

**Do not port** its four surprise dimensions — content, structural, temporal, error. They read git metadata: modified file counts, diff size, late-night timestamps, error counts. They describe a *coding session*, not a generic memory row. CommonMind stores neither.

---

## 8. Scope boundary

**In scope Monday:** surprise scoring; the `surprise` and `pattern` consolidation kinds; the before/after measurement.

**Explicitly out:** `digest` and `insight` kinds; scheduling or cron infrastructure (run it by hand — a manual invocation is a legitimate demo); any UI; any change to the capture or recall request path.

If it isn't in the "in scope" line, it is not Monday's problem.

---

## 9. Definition of done

Maps 1:1 to [`CHECKLIST.md`](CHECKLIST.md) → Mon Aug 10:

- [ ] Surprise scoring implemented via embedding distance, thresholds tuned against real data
- [ ] Pattern extraction writing `memory_consolidations` rows with populated `source_entity_ids`
- [ ] Before/after recall measured on the same fixed question set, numbers and method in `BUILD_LOG.md`
- [ ] **Gate:** a real learning curve — or the claim comes off the site

---

## 10. If it slips

Dream-Weaver is cut *last* among L4s, which also means it is cut *before* anything in L1–L3. If Monday ends without the measurement, it goes — and the "improves itself" language comes off the landing page the same day, not on Aug 16.

Timebox: one day. Do not let it eat Tuesday's MCP work, which is on the critical path and this is not.
