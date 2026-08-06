# SG 2.1 Semantic

This branch contains the active SG 2.1 architecture and executable platform core through Block 2.

## Requirements
- Node.js 22
- npm 10+

## Start
```bash
npm ci
npm test
npm run check
npm start
```

`npm start` runs the Block 2 local fixture and demonstrates confirmed project-memory restoration through the context-aware semantic pipeline.

## Implemented
### Block 0 — Engineering Foundation
- project structure, contracts, local runner, tests and CI
- minimal identity, scope, trace and error contracts

### Block 1 — Semantic Kernel
- canonical input and semantic contracts
- injected MeaningInterpreter boundary
- DecisionEnvelope and ResponsePlan
- safe clarification, answer and prepare-only decisions

### Block 2 — Context and Memory
- seven memory layers
- ContextRequest and ContextBundle
- provenance, trust, confirmation and expiration
- strict user/project/group/thread isolation
- duplicate and conflict detection
- bounded deterministic context selection
- working in-memory provider
- integration with Semantic Kernel

## Current boundary
The in-memory provider is a working Block 2 reference implementation, not durable production storage. Database persistence and migrations are intentionally deferred. The branch still contains no Telegram transport, production identity linking, Action Gate, protected execution or external AI-provider integration.

## Authority
Read in this order:
1. `pillars/DECISIONS.md`
2. `pillars/README.md`
3. `pillars/architecture/README.md`
4. `pillars/roadmap/README.md`
5. `pillars/workflow/README.md`
