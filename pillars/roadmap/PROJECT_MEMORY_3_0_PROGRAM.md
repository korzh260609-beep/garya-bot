# SG 2.1 — PROJECT MEMORY 3.0 PROGRAM

## Status
Implementation in progress.

Closed stages: **PM3.1, PM3.2, PM3.3, PM3.4**.
Next stage: **PM3.5 — Deduplication & Conflict Resolver**.

Project Memory 3.0 specializes the completed Memory 2.0 `Project Memory` domain. It does not renumber Blocks 0–19 and must not replace System Self Knowledge, Conversation Context, Identity/Scope, Action Gate, Resource Authority, PostgreSQL persistence or Universal Diagnostics.

## Goal
Deliver a production Project Memory that automatically captures only policy-approved project facts, preserves provenance/history, resolves duplicates/conflicts, performs hybrid temporal retrieval and injects only bounded authorized facts into normal SG answers.

## Program order

### PM3.1 — Project Fact Contract & Namespaces
- define canonical project-fact schema;
- define namespaces for architecture, features, identity, memory, security, integrations, infrastructure, decisions, roadmap and incidents;
- define lifecycle/temporal fields and relations;
- preserve Memory 2.0 trust/provenance/scope rules.

**Gate:** contract tests prove no cross-project leakage and no authority fields can be granted by memory.

### PM3.2 — Durable PostgreSQL Store & Migration
- add versioned storage/repositories for project entries, provenance, relations, conflicts and audit/lifecycle history;
- preserve restart continuity;
- keep raw secrets forbidden;
- prepare optional pgvector-compatible index fields/migration path.

**Gate:** write/read/restart tests pass against PostgreSQL.

### PM3.3 — Trusted Source Ingestion Boundary
- define trusted project-event contract;
- support at least one real verified source first (GitHub is preferred because current SG development truth is repository-backed);
- keep Render unavailable until a real Render Connector exists;
- keep raw chat/model output non-verified by default;
- register source provenance and idempotency identity.

**Gate:** one real trusted source produces a bounded candidate with verifiable provenance; weak/unknown sources fail closed.

### PM3.4 — Candidate / Confirmation / Monarch Control
- implement candidate state;
- policy-driven confirmation/rejection;
- explicit Monarch confirmation/correction/invalidation operations through Owner Security;
- no direct model confirmation;
- preserve audit/history.

**Status:** CLOSED. Verified candidates remain `temporary/proposed` until an Owner Security-authorized Monarch operation activates them. Confirmation, rejection, correction and invalidation are policy-gated; model/LLM direct control fails closed; audit metadata and durable history are preserved.

**Gate:** candidate cannot become active without valid confirmation policy/authority.

### PM3.5 — Deduplication & Conflict Resolver
- deterministic duplicate keys using trace/event/source/entity/fingerprint;
- semantic similarity only as secondary evidence;
- conflict records remain visible;
- source/trust/time/Monarch policy resolves only when evidence is sufficient.

**Gate:** replay of one trusted event is idempotent; contradictory sources do not silently overwrite current truth.

### PM3.6 — Temporal History & Supersession
- implement `valid_from`, `valid_to`, `superseded_at` and successor chains;
- support status evolution such as `planned → implementing → implemented → tested → closed`;
- preserve old versions for audit/history queries.

**Gate:** current and historical queries return different correct views without destructive history loss.

### PM3.7 — Hybrid Retrieval & pgvector
- metadata prefilter by project/namespace/entity/type/status/lifecycle/time;
- semantic retrieval through PostgreSQL/pgvector when enabled;
- bounded relation expansion;
- rank by relevance + exact match + trust + confirmation + freshness + scope specificity;
- do not introduce a second vector database without later architecture approval.

**Gate:** semantic and exact retrieval both work and never bypass authorization.

### PM3.8 — Project Memory Context Guard
- enforce project scope, namespace, lifecycle, trust, confirmation, sensitivity, conflict visibility and token/fact limits;
- isolate embedded prompt/instruction text as data;
- expose provenance needed for evidence-aware answers.

**Gate:** rejected/superseded/unauthorized/secret-bearing facts cannot reach the model context.

### PM3.9 — AI Router Integration
- route any extraction/embedding/summarization assistance only through AI Router;
- forbid direct AI storage access/mutation;
- inject bounded `ProjectMemoryContext` only when relevant to a normal request;
- preserve deterministic fallback when model/provider is unavailable.

**Gate:** E2E proves normal SG question → retrieval → guarded context → AI Router → correct evidence-aware answer.

### PM3.10 — Decision & Incident Memory
- structured architectural/project decisions with rationale and supersession;
- structured incidents with symptom, evidence-confirmed root cause, fix and status;
- historical incident similarity may guide but never prove a live diagnosis.

**Gate:** SG can answer both “what is the current decision?” and “why was it made?” while preserving old decisions/incidents as history.

### PM3.11 — Diagnostics & Observability
Required checks/events include:
- `project_memory_health`;
- `project_memory_counts`;
- `project_memory_search_test`;
- `project_memory_duplicate_test`;
- `project_memory_conflict_test`;
- `project_memory_source_test`;
- `project_memory_context_test`;
- `project_memory_restart_continuity_test`;
- bounded write/read/retrieval/supersession/conflict audit metadata.

**Gate:** diagnostics identify store/retrieval/source/context failures without dumping raw sensitive memory.

### PM3.12 — Production E2E & Live Acceptance
Prove in deployed SG:

```text
trusted source
→ durable project fact
→ restart continuity
→ hybrid retrieval
→ context guard
→ normal SG request
→ correct answer with provenance/currentness
```

Also prove:
- stale fact is not represented as live truth when live verification is unavailable;
- one source replay does not duplicate memory;
- conflicting evidence is visible;
- raw chat cannot self-confirm;
- Render is not claimed as a live source before Render Connector implementation.

**Gate:** all acceptance criteria in `../architecture/PROJECT_MEMORY_3_0.md` are verified by code, tests, CI and runtime evidence.

## Definition of DONE
Project Memory 3.0 is not complete because architecture files exist or unit tests pass. DONE requires production evidence that SG automatically uses Project Memory in ordinary relevant requests and can answer current project-state questions from authorized evidence with provenance, temporal correctness and explicit uncertainty where live verification is missing.

## Dependencies
Uses existing:
- Memory 2.0;
- Identity & Scope;
- PostgreSQL Persistence;
- AI Router;
- Action Gate;
- Monarch/Owner Security;
- External Connections Registry;
- Resource Ownership & Authority;
- Internal Event Bus;
- Observability;
- Feature/contract controls.

Future source integration such as Render depends on an actually implemented and verified connector; this program must not fake connector availability.
