# SG 2.1 Semantic

This branch contains the clean SG 2.1 architecture and its engineering foundation.

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

## Current boundary
The repository currently provides only Block 0 infrastructure:
- canonical identity, scope and trace fixtures
- canonical error type
- local runner
- tests
- CI

It intentionally contains no Telegram transport, database, durable memory, model provider, protected action execution or domain logic.

## Authority
Read in this order:
1. `pillars/DECISIONS.md`
2. `pillars/README.md`
3. `pillars/architecture/README.md`
4. `pillars/roadmap/README.md`
5. `pillars/workflow/README.md`

Functional development starts with `pillars/roadmap/01_SEMANTIC_KERNEL.md` only after Block 0 checks pass.
