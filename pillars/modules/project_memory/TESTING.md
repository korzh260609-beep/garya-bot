# project_memory TESTING

> AGENT NOTE:
> This file defines Project Memory test coverage for SG 2.0.
> Tests must prove safety boundaries before runtime sync, AI, Telegram, or automatic DB writes are added.

Статус: V1 OWNERSHIP / MULTI-PROJECT SCOPE TESTING

---

## 1. Current smoke scripts

Current smokes:

```text
scripts/smokeProjectMemorySkeleton.js
scripts/smokeProjectMemoryStorageConfirmation.js
scripts/smokeProjectMemoryRuntimeContext.js
scripts/smokeMessageProjectMemoryContextGate.js
scripts/smokeProjectMemorySchemaBootstrap.js
scripts/smokeProjectMemoryRuntimeDiagnostics.js
scripts/smokeProjectMemoryOwnershipScope.js
```

Current npm commands:

```text
npm run smoke:project-memory-skeleton
npm run smoke:project-memory-storage-confirmation
npm run smoke:project-memory-runtime-context
npm run smoke:message-project-memory-context-gate
npm run smoke:project-memory-schema-bootstrap
npm run smoke:project-memory-runtime-diagnostics
npm run smoke:project-memory-ownership-scope
```

Current CI workflow:

```text
.github/workflows/sg2-smoke.yml
```

---

## 2. What V1 ownership scope smoke must prove

The ownership scope smoke must prove:

```text
buildSgProjectMemoryRef()
buildUserProjectMemoryKey()
buildUserProjectMemoryRef()
parseProjectMemoryKey()
canReadProjectMemory()
canWriteProjectMemoryCandidate()
```

It must prove:

```text
SG project memory uses project_key='sg'
user project memory uses project_key='user_project:<globalUserId>:<userProjectId>'
one user can own multiple user projects
same user projects are isolated from each other
different users' projects are isolated even if project names match
monarch/system can read SG project memory
guests cannot read SG project memory
user can read/write candidate memory for own project
user cannot read/write another user's project memory
ownership is not inferred from chat text or magic phrases
```

It must not touch real PostgreSQL.

It must not require `DATABASE_URL`.

It must not call AI.

It must not touch Telegram.

It must not write memory entries.

---

## 3. What V1 skeleton smoke must prove

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

## 4. What V1 storage confirmation smoke must prove

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

## 5. What V1 runtime context smoke must prove

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

## 6. What V1 message injection gate smoke must prove

The message gate smoke must prove:

```text
getMessageProjectMemoryContextGateOptionsFromEnv()
prepareMessageProjectMemoryContextGate()
prepareMessageContextInjection()
```

It must prove three modes:

```text
disabled        -> no read, no project_memory items, no injection
read_only       -> read confirmed facts into contextPack, no injection
read_and_inject -> read confirmed facts and inject context only through messageContextInjection
```

It must also prove:

```text
read failure -> no prompt injection
read disabled -> runtimeContext is not called
prompt injection disabled by default env
Project Memory read disabled by default env
```

The smoke uses a mock runtime context.

It must not touch real PostgreSQL.

It must not require `DATABASE_URL`.

---

## 7. What V1 schema bootstrap smoke must prove

The schema bootstrap smoke must prove:

```text
getProjectMemorySchemaBootstrapOptionsFromEnv()
bootstrapProjectMemorySchema()
```

It must prove:

```text
default env -> bootstrap disabled -> no DB attempt
enabled without DATABASE_URL -> safe failure / no startup fail by default
enabled without DATABASE_URL + failStartupOnError -> throws intentionally
```

It must not touch real PostgreSQL.

It must not require `DATABASE_URL`.

It must not write memory entries.

---

## 8. What V1 runtime diagnostics smoke must prove

The runtime diagnostics smoke must prove:

```text
runProjectMemoryRuntimeCheck()
diagnosticsCheckRegistry includes project_memory_runtime
```

It must prove:

```text
default env -> Project Memory boundaries OK
prompt injection enabled without read -> warning
schema bootstrap enabled without DB -> warning
registry execution returns project_memory_runtime_check
```

It must not touch real PostgreSQL.

It must not call AI.

It must not touch Telegram.

It must not write memory entries.

It must not mutate repository/runtime files.

---

## 9. Required safety assertions

The smokes must assert:

- SG project memory and user project memory are separate;
- one user may own many user projects;
- same user projects do not share Project Memory by default;
- different users' projects do not share Project Memory even if names match;
- ownership is not inferred from natural language;
- service is enabled;
- prepare-only runtime skeleton remains safe;
- runtime DB integration is not enabled from the public status;
- storage boundary exists separately;
- confirmation boundary exists separately;
- runtime read bridge exists separately;
- runtime read bridge reads only confirmed active entries;
- message gate exists separately;
- message gate default disables Project Memory read;
- message gate default disables prompt injection;
- message gate read and prompt injection use separate flags;
- read failure disables prompt injection;
- schema bootstrap exists separately;
- schema bootstrap default disables DB attempt;
- schema bootstrap does not write memory entries;
- schema bootstrap does not read Project Memory context;
- schema bootstrap does not enable prompt injection;
- runtime diagnostics check exists separately;
- runtime diagnostics check is read-only;
- runtime diagnostics check does not call AI;
- runtime diagnostics check does not touch Telegram;
- runtime diagnostics warns on unsafe flag combinations;
- source fetching is disabled;
- AI calls are disabled in memory/gate/bootstrap/diagnostics layers;
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

## 10. What tests must not do

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

## 11. Future tests before enabling Project Memory prompt injection in production

Before enabling durable Project Memory prompt injection in production, add tests for:

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
16. Production config audit before enabling `SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED=true`.
17. Production config audit before enabling `SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED=true`.
18. Production diagnostics alerting when Project Memory flags are unsafe.
19. Real DB test proving user projects are isolated by project_key and owner checks.

---

## 12. Failure rule

If Project Memory smoke fails, SG must treat Project Memory runtime as unsafe and not connect it to Core Orchestrator, AI context injection, Telegram, DB storage, or source sync.

If ownership scope smoke fails, SG must not use Project Memory for user projects.

If storage confirmation smoke fails, SG must not use durable Project Memory confirmation in runtime flows.

If runtime context smoke fails, SG must not use confirmed Project Memory as live AI context.

If message gate smoke fails, SG must not enable Project Memory runtime reads or prompt injection in message AI requests.

If schema bootstrap smoke fails, SG must not enable Project Memory schema bootstrap in production.

If runtime diagnostics smoke fails, SG must not rely on Project Memory runtime diagnostics in production.
