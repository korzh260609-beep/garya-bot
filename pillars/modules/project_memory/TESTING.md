# project_memory TESTING

> AGENT NOTE:
> This file defines Project Memory test coverage for SG 2.0.
> Tests must prove safety boundaries before runtime storage, sync, AI, Telegram, or DB writes are added.

Статус: V1 RUNTIME SKELETON TESTING

---

## 1. Current smoke script

Current smoke:

```text
scripts/smokeProjectMemorySkeleton.js
```

Current npm command:

```text
npm run smoke:project-memory-skeleton
```

Current CI workflow:

```text
.github/workflows/sg2-smoke.yml
```

---

## 2. What V1 smoke must prove

The smoke test must prove:

```text
ProjectMemoryService.status()
ProjectMemoryService.getDiagnostics()
ProjectMemoryService.buildCandidate()
ProjectMemoryService.validateCandidate()
ProjectMemoryService.normalizeProvidedItems()
ProjectMemoryService.selectForContext()
ProjectMemoryService.buildContextItems()
```

---

## 3. Required safety assertions

The smoke must assert:

- service is enabled;
- mode is read-only / prepare-only runtime skeleton;
- DB reads are disabled;
- DB writes are disabled;
- source fetching is disabled;
- AI calls are disabled;
- transport touching is disabled;
- repository mutation is disabled;
- durable writes are disabled;
- confirmation is required for durable memory;
- buildCandidate creates `candidate`, not `confirmed`;
- empty content blocks candidate validation;
- missing source gives warning;
- secret-like content is blocked;
- raw env/log source types are blocked;
- selectForContext applies item limit;
- buildContextItems creates `project_memory` context items below verified sources;
- context items are owned by `sg_project`;
- invalid input does not throw and returns warnings.

---

## 4. What tests must not do

Tests must not:

- connect to DB;
- require DATABASE_URL;
- call OpenAI;
- call Telegram;
- call Render;
- call GitHub API;
- read secrets;
- write runtime files;
- write repository files;
- depend on network;
- depend on current date/time for correctness.

---

## 5. Future tests before durable memory

Before adding durable Project Memory storage, add tests for:

1. DB schema migration.
2. Read path.
3. Candidate write path.
4. Confirmation path.
5. Supersede/archive path.
6. Conflict detection.
7. Secret redaction.
8. Audit trace.
9. Context builder size limits.
10. Source priority enforcement.

---

## 6. Failure rule

If Project Memory smoke fails, SG must treat Project Memory runtime as unsafe and not connect it to Core Orchestrator, AI context injection, Telegram, DB storage, or source sync.
