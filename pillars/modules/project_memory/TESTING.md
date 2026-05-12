# project_memory TESTING

> AGENT NOTE:
> This file defines Project Memory test coverage for SG 2.0.
> Tests must prove safety boundaries before runtime sync, AI, Telegram, or automatic DB writes are added.

Статус: V1 RUNTIME READ CONTEXT TESTING

---

## 1. Current smoke scripts

Current smokes:

```text
scripts/smokeProjectMemorySkeleton.js
scripts/smokeProjectMemoryStorageConfirmation.js
scripts/smokeProjectMemoryRuntimeContext.js
```

Current npm commands:

```text
npm run smoke:project-memory-skeleton
npm run smoke:project-memory-storage-confirmation
npm run smoke:project-memory-runtime-context
```

Current CI workflow:

```text
.github/workflows/sg2-smoke.yml
```

---

## 2. What V1 skeleton smoke must prove

The skeleton smoke must prove:

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

## 3. What V1 storage confirmation smoke must prove

The storage confirmation smoke must prove:

```text
ProjectMemoryStore.createCandidate()
ProjectMemoryStore.confirmCandidate()
ProjectMemoryStore.listEntries()
ProjectMemoryConfirmation.status()
ProjectMemoryConfirmation.getDiagnostics()
ProjectMemoryConfirmation.prepareCandidateForConfirmation()
ProjectMemoryConfirmation.confirmCandidate()
ProjectMemoryConfirmation.listConfirmedEntries()
```

The smoke uses an injected in-memory `queryFn`.

It must not touch real PostgreSQL.

It must not require `DATABASE_URL`.

---

## 4. What V1 runtime context smoke must prove

The runtime context smoke must prove:

```text
ProjectMemoryRuntimeContext.status()
ProjectMemoryRuntimeContext.getDiagnostics()
ProjectMemoryRuntimeContext.loadConfirmedProjectMemoryFacts()
ProjectMemoryRuntimeContext.buildConfirmedProjectMemoryContextItems()
buildContextPack() with loaded Project Memory facts
formatContextPackForPrompt() with Project Memory context
```

The smoke uses an injected in-memory `queryFn`.

It must not touch real PostgreSQL.

It must not require `DATABASE_URL`.

It must not inject prompt context by itself.

---

## 5. Required safety assertions

The smokes must assert:

- service is enabled;
- prepare-only runtime skeleton remains safe;
- runtime DB integration is not enabled from the public status;
- storage boundary exists separately;
- confirmation boundary exists separately;
- runtime read bridge exists separately;
- runtime read bridge reads only confirmed active entries;
- source fetching is disabled;
- AI calls are disabled;
- transport touching is disabled;
- repository mutation is disabled;
- prompt injection is disabled in runtime read bridge;
- buildCandidate creates `candidate`, not `confirmed`;
- store creates `trust='candidate'` and `status='pending_confirmation'`;
- confirmation changes candidate to `trust='confirmed'` and `status='active'`;
- missing entryId blocks confirmation;
- double confirmation fails safely;
- rejected candidates are not stored;
- empty content blocks candidate validation;
- missing source gives warning;
- secret-like content is blocked;
- raw env/log source types are blocked;
- selectForContext applies item limit;
- buildContextItems creates `project_memory` context items below verified sources;
- runtime context bridge creates `project_memory` items below verified sources;
- context items are owned by `sg_project`;
- prompt formatter does not include blocked `user_message` content by default;
- invalid input does not throw and returns warnings.

---

## 6. What tests must not do

Tests must not:

- connect to real DB;
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

## 7. Future tests before connecting Project Memory to live AI context injection

Before connecting durable Project Memory to live AI context injection, add tests for:

1. DB schema migration against a controlled test DB.
2. Read path from storage.
3. Candidate write path with real PostgreSQL.
4. Confirmation path with real PostgreSQL.
5. Supersede/archive path.
6. Conflict detection.
7. Secret redaction.
8. Audit trace.
9. Context builder size limits.
10. Source priority enforcement.
11. Permission checks for who may confirm memory.
12. Explicit approval reference checks.
13. Explicit feature flag for runtime Project Memory reads.
14. Explicit feature flag for prompt injection.
15. Fallback behavior when storage read fails.

---

## 8. Failure rule

If Project Memory smoke fails, SG must treat Project Memory runtime as unsafe and not connect it to Core Orchestrator, AI context injection, Telegram, DB storage, or source sync.

If storage confirmation smoke fails, SG must not use durable Project Memory confirmation in runtime flows.

If runtime context smoke fails, SG must not use confirmed Project Memory as live AI context.
