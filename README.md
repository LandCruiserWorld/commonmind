# CommonMind

> **CockroachDB-as-memory for the agentic workforce.** Agents that think. Agents that act. Agents that remember — **reliably, globally, at any scale.**

CommonMind is a memory layer built on **CockroachDB** so agents never lose context, and humans stay in control. One memory, held in common: your people and your agents write to the same store and read from the same store, so neither side has to reconstruct what the other already knows. The DB is the system of record for that shared memory — a task earlier databases weren't built for.

**Live:** [commonmind.agent9.dev](https://commonmind.agent9.dev)

![Apache-2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg) ![CockroachDB](https://img.shields.io/badge/storage-CockroachDB-29b1f8) ![AWS](https://img.shields.io/badge/cloud-AWS-orange) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6) ![status](https://img.shields.io/badge/status-building-yellow)

---

## The thesis

Traditional databases were tuned for human-scale reads and writes. Agentic systems are different: they **spawn autonomously, write constantly, and need memory that persists across regions and failures — with zero data loss and no downtime.**

CockroachDB was built for that. CommonMind uses it as the **memory layer** of an agent — not a bolt-on, but the thing that makes the agent useful.

```
capture → recall (memory) → act (with human approval) → improve (dream-weaver)
```

## What this repo currently contains

This is the **initial foundation**: the product bible and machine-readable spec, the public landing page, the seed CockroachDB schema, and the TypeScript memory core. Actual application source lands in the coming commits.

- `src/` — TypeScript core (config, connection, memory repository, schema)
- `docs/` — spec, strategy, build log, landing (the "bible")
- `tests/` — seed tests

## Requirements

- **CockroachDB** — Distributed Vector Indexing, Managed MCP Server, ccloud CLI, Agent Skills
- **AWS** — Bedrock (embeddings), Lambda (pipelines), S3, SNS

## Quickstart (dev mode)

1. Install CockroachDB (local or Cloud) and start it.
2. Copy & fill env:
   ```bash
   cp .env.example .env
   ```
3. Apply the schema, then run:
   ```bash
   npm install
   npm run check
   npm test
   ```

## Architecture

```
 AI Agents               CockroachDB Memory              AWS
┌────────────────┐       ┌────────────────────┐       ┌───────────────────┐
│ Memory Agent   │──────▶│ notifications      │       │ Amazon Bedrock     │
│ Operator Agent │       │ memory_embeddings  │──CDC──▶│ AWS Lambda (fanout)│
│ Dream-Weaver   │◀──────│ live_activities    │       │ SNS · S3           │
└────────────────┘  recall/└────────────────────┘       └───────────────────┘
   MCP · Skills        approve        VECTOR(768) · HNSW    push · artifacts
```

Full diagram: [`assets/architecture.svg`](assets/architecture.svg)

**The atomic-write invariant:** a memory record and its embedding commit in the **same transaction** — agents and humans never observe inconsistent memory. Dream-weaver consolidation and the CDC → SNS → Lambda push pipeline read only from those transactional tables.

## Docs
- [Docs index](docs/README.md) — spec, strategy, build log, agents
- [Build log](docs/BUILD_LOG.md) — live status & locked decisions

## License
[Apache-2.0](LICENSE)

_Built for the [CockroachDB × AWS Hackathon — Build with Agentic Memory](https://cockroachdb-ai.devpost.com/)._