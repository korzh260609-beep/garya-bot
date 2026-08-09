# SG 2.1 — MEMORY 2.0 ROADMAP

## Status

Planned canonical program. No M-block is completed merely by this document. Completion requires code, tests and verified runtime evidence.

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

- [ ] shared group memory can exist without using a fake `global_user_id` owner;
- [ ] creator/actor provenance is preserved separately from ownership scope;
- [ ] thread memory cannot exist without group scope;
- [ ] user/group/thread/project scopes cannot contaminate each other;
- [ ] existing SG 2.1 memory data migrates without destructive loss;
- [ ] scope contracts are tested at repository/provider/capability/runtime boundaries.

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

- [ ] a shared group fact can be recalled by another authorized participant;
- [ ] the fact remains attached to the same group/resource;
- [ ] another group cannot read it;
- [ ] private personal memory is not implicitly copied into shared group memory;
- [ ] group/thread restart persistence is verified.

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

- [ ] greetings/chatter do not create durable fact memory;
- [ ] user preferences/facts route to user memory when policy permits;
- [ ] group-shared decisions route to shared group memory only when policy permits;
- [ ] thread-local information remains thread-local;
- [ ] sensitive/private information cannot be promoted to shared memory by classification error without policy protection;
- [ ] automatic capture never marks raw model/user text as verified solely because it was captured.

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

- [ ] repeated equivalent facts do not grow unbounded duplicates;
- [ ] conflicting facts remain visible until policy resolves them;
- [ ] newer confirmed facts can supersede older values without deleting audit history;
- [ ] digests retain source/provenance links;
- [ ] consolidation cannot increase trust level without valid evidence/confirmation;
- [ ] restart/retry is idempotent.

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

- [ ] relevant records rank above unrelated records;
- [ ] authorization is checked before content reaches semantic processing;
- [ ] expired/superseded values are excluded from ordinary recall;
- [ ] conflicts are not silently flattened into one false certainty;
- [ ] recall remains bounded by deterministic limits;
- [ ] tests cover user/group/thread/project isolation under semantic recall.

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

- [ ] one verified global user can recall approved personal memory from another transport;
- [ ] unlinked identities cannot see that memory;
- [ ] group memory does not migrate to unrelated groups/transports;
- [ ] identity link conflicts fail closed;
- [ ] platform username/name changes do not create a new personal memory owner.

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

- [ ] user A cannot read user B private memory;
- [ ] private memory never appears in group recall without explicit authorized promotion;
- [ ] group membership alone does not create resource ownership/admin authority;
- [ ] system/self knowledge cannot be rewritten through ordinary memory operations;
- [ ] unauthorized reads are filtered before ContextBundle construction;
- [ ] unauthorized mutations fail before persistence.

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

- [ ] expired memory is not used in ordinary answers;
- [ ] superseded memory remains available for history/audit only;
- [ ] temporary memory expires deterministically;
- [ ] permanent/confirmed memory is not deleted by generic cleanup;
- [ ] lifecycle jobs are idempotent and restart-safe;
- [ ] retention never bypasses privacy/audit requirements.

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

- [ ] diagnostics can explain why a memory was stored and why it was recalled without exposing unauthorized content;
- [ ] user/group/thread/project leakage suites pass;
- [ ] PostgreSQL restart continuity passes;
- [ ] duplicate/conflict/consolidation tests pass;
- [ ] cross-platform personal-memory tests pass;
- [ ] shared-group tests pass;
- [ ] expired/superseded/deleted-state tests pass;
- [ ] no raw secrets appear in memory or telemetry;
- [ ] `npm run check` and applicable production integration suites pass;
- [ ] completion evidence references code/tests/runtime, not roadmap status text.

## Program completion definition

Memory 2.0 may be considered implementation-complete only when M1–M9 acceptance criteria have code/test/runtime evidence and a repository-wide audit finds no competing memory ownership path, scope leak, implicit private-to-shared promotion, or bypass around the canonical memory permission boundary.

Architecture: `../architecture/MEMORY_2_0.md`.
Workflow: `../workflow/MEMORY_2_0_WORKFLOW.md`.
