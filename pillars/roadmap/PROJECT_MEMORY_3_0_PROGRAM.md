# SG 2.1 — PROJECT MEMORY 3.0 PROGRAM

## Status
Implementation in progress.

Closed stages: **PM3.1, PM3.2, PM3.3, PM3.4, PM3.5, PM3.6, PM3.7, PM3.8, PM3.9**.
Next stage: **PM3.10 — Decision & Incident Memory**.

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

**Status:** CLOSED. Canonical project-fact fingerprints are order-stable; source-event replay is protected by deterministic keys plus a PostgreSQL unique index; concurrent same-entity ingestion is serialized with a transaction advisory lock; exact canonical duplicates are suppressed; contradictory facts remain separately durable and create visible `open` conflict records instead of overwriting either side; semantic similarity is secondary evidence only; explicit conflict resolution is Owner Security-gated and records the authorized Monarch winner without silently mutating the underlying facts. PostgreSQL integration tests cover replay, exact duplicate suppression, contradiction, concurrency, cross-project isolation and authorized/unauthorized conflict resolution. Code gate verified by SG 2.1 CI #6974 SUCCESS.

**Gate:** replay of one trusted event is idempotent; contradictory sources do not silently overwrite current truth.

### PM3.6 — Temporal History & Supersession
- implement `valid_from`, `valid_to`, `superseded_at` and successor chains;
- support status evolution such as `planned → implementing → implemented → tested → closed`;
- preserve old versions for audit/history queries.

**Status:** CLOSED. Supersession is atomic and project/entity-scoped; predecessor validity is closed at the successor `validFrom`, predecessor lifecycle becomes archived, `supersededAt/successorMemoryId` are persisted, and immutable history events record both `superseded` and `became-current`. Historical `getAt` and current `getCurrent` queries return different correct temporal views. Recursive successor-chain retrieval is durable across PostgreSQL restart. Self-cycles, cross-entity links, unconfirmed versions, time mismatches and competing successors fail closed. Full code/runtime/worker/diagnostics gate verified by SG 2.1 CI #6979 SUCCESS.

**Gate:** current and historical queries return different correct views without destructive history loss.

### PM3.7 — Hybrid Retrieval & pgvector
- metadata prefilter by project/namespace/entity/type/status/lifecycle/time;
- semantic retrieval through PostgreSQL/pgvector when enabled;
- bounded relation expansion;
- rank by relevance + exact match + trust + confirmation + freshness + scope specificity;
- do not introduce a second vector database without later architecture approval.

**Status:** CLOSED. Project/authorization checks run before candidate retrieval and embedding mutation. Metadata prefiltering covers project, namespace, entity, fact type, lifecycle, status and temporal view. Exact/lexical and semantic scores are combined with trust, confirmation, freshness and scope specificity under bounded candidate/result limits. Embeddings are stored durably in PostgreSQL; when the `vector` extension is already enabled the pgvector cosine-distance path is used, otherwise retrieval falls back deterministically to PostgreSQL array storage plus bounded cosine scoring without introducing a second vector database. Relation expansion is project-scoped, filter-preserving and bounded. Embedding generation itself remains outside this stage and must later enter through AI Router in PM3.9. PostgreSQL integration tests verify exact retrieval, semantic ranking, temporal retrieval, relation expansion, authorization denial and cross-project isolation. Full migration/security/check/runtime/worker/diagnostics gate verified by SG 2.1 CI #6990 SUCCESS.

**Gate:** semantic and exact retrieval both work and never bypass authorization.

### PM3.8 — Project Memory Context Guard
- enforce project scope, namespace, lifecycle, trust, confirmation, sensitivity, conflict visibility and token/fact limits;
- isolate embedded prompt/instruction text as data;
- expose provenance needed for evidence-aware answers.

**Status:** CLOSED. `createProjectMemoryContextGuard` is the mandatory boundary between Project Memory retrieval and future model-facing context. It performs a fresh `context-read` authorization check, rejects project/namespace mismatches, rejected or unconfirmed facts, disallowed trust/lifecycle states, non-current/superseded facts, sensitivity-marked records, secret-bearing payloads and records with insufficient provenance. The guard forces normal retrieval to current active state even if a caller requests historical retrieval. Open PostgreSQL conflict records remain visible in each accepted fact and in a context-level conflict summary. Project content is emitted as `factData` with `dataOnly=true`; the context contract explicitly forbids executable embedded instructions, authority transfer from memory and secrets. Fact count and approximate token budgets are hard-bounded, and exclusions are returned only as aggregate reason counts. PM3.8 integration tests cover authorization denial, rejected/unconfirmed/historical exclusion, conflict visibility, provenance exposure, cross-project fail-closed behavior, secret-bearing exclusion, embedded instruction isolation and context budgets.

**Gate:** rejected/superseded/unauthorized/secret-bearing facts cannot reach the model context.

### PM3.9 — AI Router Integration
- route any extraction/embedding/summarization assistance only through AI Router;
- forbid direct AI storage access/mutation;
- inject bounded `ProjectMemoryContext` only when relevant to a normal request;
- preserve deterministic fallback when model/provider is unavailable.

**Status:** CLOSED. `createProjectMemoryAIRouterIntegration` is the only Project Memory model-assistance boundary. Normal response composition resolves Project Memory from the already-resolved runtime actor/project scope, performs Project Memory retrieval, filters to approved trusted source kinds, passes relevant results through PM3.8 Context Guard, removes legacy unguarded project-memory payloads from the model-facing response context, and injects only a bounded `ProjectMemoryContext` into `aiRouter.route()`. Project Memory model assistance for extraction, embedding and summarization is Router-only and receives no database/store mutation capability. Memory content is explicitly data-only and cannot grant identity, roles, permissions, ownership, resource authority, trust or confirmation. When AI is missing, fails, times out or returns an invalid final response, a deterministic provenance-bearing Project Memory answer is used when guarded evidence exists. Stored evidence is not represented as independently live-verified truth. Render remains denied as a trusted Project Memory source until a real verified Render Connector exists. PostgreSQL integration tests prove relevant normal-question injection, legacy/authority isolation, Router-only assistance, deterministic AI failure fallback and irrelevant-context exclusion. Full migration/security/check/runtime/worker/diagnostics gate verified by SG 2.1 CI #7005 SUCCESS before documentation synchronization.

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
