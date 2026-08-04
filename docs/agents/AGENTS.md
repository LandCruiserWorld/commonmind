# AGENTS.md — CommonMind

Guidance for coding agents working in this repo.

## The one rule: memory is the product
Every change should keep the atomic-write invariant intact — a memory record and
its embedding are written **in one transaction**. Never split them.

## The 10 principles (from the bible)
These are immutable. New pull requests must not contradict them:
1. Memory is the product.
2. Memory must never go down.
3. Bridge, don't flood — signal, not spam.
4. Milestones, not noise.
5. Human decides, agent executes.
6. One memory engine, any product.
7. Brain health, not timecard.
8. The front door matters — one command.
9. Memory improves itself.
10. Kill the node, memory survives.

## Build & test
```bash
npm install
npm run check   # TypeScript type-check
npm test
```

## Tool constraints
- Storage must be **CockroachDB** (vector index, changefeed-capable).
- At least one **AWS** service must back the runtime (Bedrock / Lambda / S3 / SNS).
- No secrets in source. Env via `.env` (see `.env.example`).