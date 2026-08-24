# SG 2.1 — MEMORY 2.0 ROADMAP

## Status

**Completed — implementation and runtime CI verified.** M1–M9 are implemented in the canonical SG 2.1 runtime. Completion is backed by code, PostgreSQL migrations, scope/privacy tests, restart/concurrency tests, runtime response-context integration, full repository regression tests, `npm start` and durable worker startup evidence.

## Goal

Bring SG memory from the existing durable scoped foundation to a complete production memory subsystem with first-class shared group memory, automatic capture, consolidation, intelligent recall, cross-platform personal continuity, privacy enforcement, lifecycle management and diagnostics.

## Existing foundation preserved

Memory 2.0 builds on and does not replace:

- `global_user_id` personal identity;
- project/group/thread scope model;
- PostgreSQL `memory_records` persistence;
- Session & Conversation Context;
- existing memory layers and trust/provenance contracts;
- Action Gate / Capability boundaries;
- Resource Authority;
- observability;
- Self Knowledge separation.

## Canonical implementation order

```text
M1 Memory Scope Model
→ M2 Shared Group Memory
→ M7 Memory Permissions & Privacy
→ M3 Automatic Memory Capture
→ M4 Memory Consolidation Engine
→ M5 Intelligent Recall Engine
→ M6 Cross-Platform Global Memory
→ M8 Memory Lifecycle
→ M9 Memory Control, Diagnostics & Tests
```

Security/scope foundations precede automatic capture so SG cannot become better at remembering before it becomes correct about where memory belongs and who may see it.

---

# M1 — Memory Scope Model

## Goal

Extend the canonical scope model so personal, contextual and shared memory are represented explicitly instead of overloading one user-owned record shape.

## Required scope

- user memory;
- user × group memory;
- shared group memory;
- thread/topic memory;
- project memory;
- session/conversation/archive relationships;
- System Self Knowledge separation;
- canonical scope resolver and validation;
- schema migration compatible with existing memory records.

## Acceptance criteria

- [x] shared group memory can exist without using a fake `global_user_id` owner;
- [x] creator/actor provenance is preserved separately from ownership scope;
- [x] thread memory cannot exist without group scope;
- [x] user/group/thread/project scopes cannot contaminate each other;
- [x] existing SG 2.1 memory data migrates without destructive loss;
- [x] scope contracts are tested at repository/provider/capability/runtime boundaries.

---

# M2 — Shared Group Memory

## Goal

Create first-class durable knowledge belonging to a group/resource context rather than to one participant.

## Required scope

- shared group record store/provider path;
- group and optional thread scope;
- creator/provenance metadata;
- shared decisions/rules/dates/facts;
- authorized group recall;
- group resource linkage where applicable;
- group isolation tests.

## Acceptance criteria

- [x] a shared group fact can be recalled by another authorized participant;
- [x] the fact remains attached to the same group/resource;
- [x] another group cannot read it;
- [x] private personal memory is not implicitly copied into shared group memory;
- [x] group/thread restart persistence is verified.

---

# M3 — Automatic Memory Capture

## Goal

Allow SG to detect memory-worthy facts/events and route them to the correct memory domain without treating raw dialogue as automatically confirmed truth.

## Required scope

- memory-worthiness decision;
- sensitivity/privacy classification;
- target domain/layer selection;
- proposed vs confirmed write policy;
- duplicate/conflict pre-check;
- provenance;
- capture reason diagnostics;
- noise suppression.

## Acceptance criteria

- [x] greetings/chatter do not create durable fact memory;
- [x] user preferences/facts route to user memory when policy permits;
- [x] group-shared decisions route to shared group memory only when policy permits;
- [x] thread-local information remains thread-local;
- [x] sensitive/private information cannot be promoted to shared memory by classification error without policy protection;
- [x] automatic capture never marks raw model/user text as verified solely because it was captured.

---

# M4 — Memory Consolidation Engine

## Goal

Turn growing raw/derived memory into compact current knowledge while retaining provenance and history.

## Required scope

- exact/semantic duplicate detection;
- conflict detection;
- supersession chains;
- current-value selection;
- archival;
- topic digest generation;
- dialogue/session summarization;
- reversible history;
- bounded consolidation jobs.

## Acceptance criteria

- [x] repeated equivalent facts do not grow unbounded duplicates;
- [x] conflicting facts remain visible until policy resolves them;
- [x] newer confirmed facts can supersede older values without deleting audit history;
- [x] digests retain source/provenance links;
- [x] consolidation cannot increase trust level without valid evidence/confirmation;
- [x] restart/retry is idempotent.

---

# M5 — Intelligent Recall Engine

## Goal

Retrieve the smallest relevant authorized memory set for the current request instead of loading arbitrary records by layer alone.

## Required scope

- query intent/entity/topic extraction;
- scope/privacy prefilter;
- candidate retrieval;
- relevance ranking;
- exact key/entity boosts;
- trust/confirmation weighting;
- freshness/lifecycle weighting;
- conflict-aware selection;
- ContextBundle limits;
- recall diagnostics.

## Acceptance criteria

- [x] relevant records rank above unrelated records;
- [x] authorization is checked before content reaches semantic processing;
- [x] expired/superseded values are excluded from ordinary recall;
- [x] conflicts are not silently flattened into one false certainty;
- [x] recall remains bounded by deterministic limits;
- [x] tests cover user/group/thread/project isolation under semantic recall.

---

# M6 — Cross-Platform Global Memory

## Goal

Make personal long-term memory follow the verified `global_user_id` across supported transports while keeping resource/group memory local to its resource scope.

## Required scope

- verified identity-link integration;
- personal memory portability across Telegram/Discord/Web/API adapters;
- prevention of platform-ID duplicate users;
- resource/group non-portability rules;
- explicit cross-transport tests.

## Acceptance criteria

- [x] one verified global user can recall approved personal memory from another transport;
- [x] unlinked identities cannot see that memory;
- [x] group memory does not migrate to unrelated groups/transports;
- [x] identity link conflicts fail closed;
- [x] platform username/name changes do not create a new personal memory owner.

---

# M7 — Memory Permissions & Privacy

## Goal

Enforce who may read, create, confirm, promote, change, archive or delete each memory class before recall or mutation occurs.

## Required scope

- privacy classes: `private`, `user-group`, `group`, `project`, `system`, `public`;
- permission matrix;
- membership/resource-authority integration where required;
- promotion policy between scopes;
- sensitive-data handling;
- administrative audit;
- fail-closed defaults.

## Acceptance criteria

- [x] user A cannot read user B private memory;
- [x] private memory never appears in group recall without explicit authorized promotion;
- [x] group membership alone does not create resource ownership/admin authority;
- [x] system/self knowledge cannot be rewritten through ordinary memory operations;
- [x] unauthorized reads are filtered before ContextBundle construction;
- [x] unauthorized mutations fail before persistence.

---

# M8 — Memory Lifecycle

## Goal

Manage freshness, expiry, supersession, archival and retention so SG remembers useful current information and does not treat obsolete data as current truth.

## Required scope

- lifecycle state;
- `last_accessed_at` where needed;
- expiry;
- supersession;
- archival;
- retention/deletion policy;
- temporary vs durable memory;
- cleanup/reconciliation jobs.

## Acceptance criteria

- [x] expired memory is not used in ordinary answers;
- [x] superseded memory remains available for history/audit only;
- [x] temporary memory expires deterministically;
- [x] permanent/confirmed memory is not deleted by generic cleanup;
- [x] lifecycle jobs are idempotent and restart-safe;
- [x] retention never bypasses privacy/audit requirements.

---

# M9 — Memory Control, Diagnostics & Tests

## Goal

Make Memory 2.0 inspectable, testable and production-operable.

## Required scope

- memory statistics by permitted scope;
- conflict/duplicate/expiry counters;
- recall trace diagnostics;
- capture reason diagnostics;
- provenance/history inspection;
- administrative control path;
- migrations/repair checks;
- unit/integration/E2E tests;
- restart and concurrency tests;
- privacy/leakage tests.

## Acceptance criteria

- [x] diagnostics can explain why a memory was stored and why it was recalled without exposing unauthorized content;
- [x] user/group/thread/project leakage suites pass;
- [x] PostgreSQL restart continuity passes;
- [x] duplicate/conflict/consolidation tests pass;
- [x] cross-platform personal-memory tests pass;
- [x] shared-group tests pass;
- [x] expired/superseded/deleted-state tests pass;
- [x] no raw secrets appear in memory or telemetry;
- [x] `npm run check` and applicable production integration suites pass;
- [x] completion evidence references code/tests/runtime, not roadmap status text.

## Completion evidence

Implementation:

- `src/memory2/memory2.js` — canonical M1–M9 service, scope/privacy/lifecycle/capture/consolidation/recall/control boundary;
- `src/memory2/inMemoryMemory2Store.js` — deterministic in-memory persistence for tests/local runtime;
- `src/memory2/postgresMemory2Store.js` — durable PostgreSQL store and concurrency-safe writes;
- `src/memory2/memory2Capabilities.js` — explicit Memory 2.0 capability surface;
- `src/persistence/migrations/178_memory_2_0.sql` — non-destructive Memory 2.0 schema migration and legacy compatibility bridge;
- `src/persistence/migrations/179_memory_2_0_guest_autocapture_guard.sql` — fail-closed production guard preventing guest-only identities from receiving durable automatic memory;
- production runtime integrates Memory 2.0 capture and bounded authorized recall while preserving Session & Conversation Context and Self Knowledge separation.

Verification:

- `tests/memory2.test.js` — M1–M9 scope, leakage, capture, duplicate/conflict, recall, global identity, lifecycle and diagnostics suite;
- `tests/memory2Postgres.test.js` — shared persistence, legacy migration compatibility, concurrency/restart/lifecycle and guest durable auto-capture guard;
- `tests/boundedResponseContext.test.js` — authorized memory reaches response composition only through bounded context;
- `tests/runtimeComposition.test.js` — runtime integration and observability regression;
- `tests/postgresPersistence.test.js` — full 19-migration compatibility and durable persistence regression;
- GitHub Actions CI run **#6745** passed migration, Memory 2.0 unit/PostgreSQL/runtime tests, full repository regression suite, `npm start`, and `npm run start:worker` before final documentation/CI cleanup.

## Program completion definition

Memory 2.0 is implementation-complete when M1–M9 acceptance criteria have code/test/runtime evidence and a repository-wide audit finds no competing memory ownership path, scope leak, implicit private-to-shared promotion, or bypass around the canonical memory permission boundary. The implementation above satisfies this definition; final canonical CI remains the ongoing regression gate.

Architecture: `../architecture/MEMORY_2_0.md`.
Workflow: `../workflow/MEMORY_2_0_WORKFLOW.md`.
