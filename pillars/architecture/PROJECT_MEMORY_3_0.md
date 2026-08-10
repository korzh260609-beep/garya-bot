# SG 2.1 — PROJECT MEMORY 3.0 CANONICAL ARCHITECTURE

## Status
Planned cross-cutting architecture program. It specializes the completed Memory 2.0 `Project Memory` domain and does not replace Memory 2.0, System Self Knowledge, Conversation Context, Identity/Scope, Action Gate, Resource Authority or PostgreSQL persistence.

## Purpose
Project Memory 3.0 gives SG durable, evidence-backed knowledge about the project itself: current implementation state, architectural decisions, roadmap state, incidents, verified project events, relationships and historical evolution.

Canonical flow:

```text
trusted project source/event
→ normalization
→ trust/provenance evaluation
→ candidate
→ duplicate/conflict evaluation
→ confirmation policy
→ active project fact
→ hybrid/temporal retrieval
→ context guard
→ SG ContextBundle
→ AI Router
```

AI models may assist extraction, normalization, embeddings or explanation only through AI Router. AI output alone is never project truth and cannot directly mutate Project Memory.

## Scope boundaries
Project Memory owns project-scoped knowledge only. It does not own personal user facts, ordinary conversation continuity, SG canonical identity/architecture truth owned by System Self Knowledge, live operational truth requiring diagnostics, credentials/secrets, permissions, roles, ownership or authority.

## Source classes
Policy-controlled source classes may include:
- verified GitHub repository events/evidence;
- verified CI/test evidence;
- verified deployment/runtime evidence through an approved connector when that connector exists;
- explicit Monarch-confirmed project decisions;
- approved bounded SG internal events;
- later trusted connectors registered through External Connections Registry and Resource Authority.

Architectural support for a source kind does not prove a connector exists. Render evidence is unavailable until a real Render Connector is implemented and verified.

Raw chat, model output, summaries and inferred statements are not automatically verified project facts.

## Canonical project fact
Each durable fact must support at least:
- `project_key`;
- stable `memory_id`;
- `namespace`;
- `fact_type`;
- `entity_key` and optional relation keys;
- normalized fact payload;
- source kind/reference;
- actor/creator provenance where applicable;
- trust;
- confidence for derived records;
- confirmation state;
- lifecycle state;
- `trace_id` and/or source-event idempotency key;
- `valid_from` and optional `valid_to`;
- `created_at`, `updated_at`;
- optional `confirmed_at`;
- optional `superseded_at` plus successor relation;
- version/revision metadata;
- bounded metadata/tags.

Raw secrets are forbidden payloads.

## Initial namespaces
```text
project.sg2.1.architecture
project.sg2.1.features
project.sg2.1.identity
project.sg2.1.memory
project.sg2.1.security
project.sg2.1.integrations
project.sg2.1.infrastructure
project.sg2.1.decisions
project.sg2.1.roadmap
project.sg2.1.incidents
```

## Candidate/confirmation pipeline
```text
EVENT
→ NORMALIZE
→ TRUST CHECK
→ CANDIDATE
→ DUPLICATE CHECK
→ CONFLICT CHECK
→ CONFIRM / REJECT / REQUIRE MONARCH CONFIRMATION
→ ACTIVE FACT
```

The pipeline is fail-closed for ambiguous source identity, project scope, weak provenance or conflicting evidence. Raw dialogue may create a candidate only when capture policy allows it and cannot auto-confirm itself.

## Trust
Project Memory reuses Memory 2.0 trust semantics:
- `verified` — verified external/runtime evidence under approved source policy;
- `confirmed` — explicitly confirmed by authorized policy/actor;
- `reported` — sourced but not independently confirmed;
- `unverified` — not trusted as project truth.

Derived facts keep confidence separately and cannot become verified merely because AI produced them.

## Temporal history and supersession
Project facts evolve through supersession rather than destructive replacement:

```text
planned → implementing → implemented → tested → closed
```

Older authoritative facts become `superseded`, retain provenance/history and receive validity boundaries. New facts become current/active. Retrieval must support both current-state and historical questions.

## Deduplication
Duplicate prevention combines:
- `trace_id` / event id;
- source reference;
- repository object/commit/PR identity;
- project key + namespace + entity + fact type;
- normalized payload fingerprint;
- semantic similarity only as a secondary signal.

Semantic similarity alone must not collapse distinct events.

## Conflict resolution
Conflicts cannot be silently hidden. Resolution considers:
1. project/scope match;
2. source authenticity/provenance;
3. trust/confirmation;
4. temporal validity/freshness;
5. explicit Monarch decision where authorized;
6. deterministic source precedence from policy.

Unresolved conflicts remain visible and cannot be presented as confident truth.

## Decision memory
Architectural/project decisions are stored structurally with decision, rationale, status, provenance, validity interval and supersession links. This allows SG to answer both what a rule is and why it exists.

## Incident memory
Incidents may store symptom, evidence-confirmed root cause, fix, status, source evidence and history. Historical similarity may guide investigation but cannot prove a present root cause; Universal Diagnostics remains the live evidence-based diagnostic authority.

## Storage
Primary durable storage remains PostgreSQL through existing persistence boundaries. Project Memory may use repositories/tables conceptually equivalent to entries, sources/provenance, relations, conflicts, audit/lifecycle history and retrieval-index metadata.

Semantic retrieval should prefer PostgreSQL-compatible vector indexing (`pgvector`) when introduced, avoiding a second database unless a later architecture decision proves it necessary.

## Relations / project knowledge graph
Project facts may form bounded evidence-backed relations such as:
```text
feature implements capability
feature depends_on module
PR completes feature
component supersedes component
incident affected module
decision governs subsystem
```

Graph traversal cannot elevate trust or bypass scope.

## Hybrid retrieval
Recall combines exact metadata filters, namespace/lifecycle filters, temporal validity, trust/confirmation weighting, semantic relevance, bounded relation expansion and freshness.

```text
request
→ project/scope authorization
→ classify project-memory need
→ metadata prefilter
→ semantic/relational candidate retrieval
→ trust/lifecycle/temporal filtering
→ conflict handling
→ bounded ranking
→ ProjectMemoryContext
```

The entire store is never injected into a prompt.

## Project Memory Context Guard
Before facts reach semantic processing/answer composition, the guard enforces:
- authorized project scope;
- allowed namespaces;
- active/valid lifecycle state;
- trust/confirmation required by the question;
- secret/sensitive exclusion;
- prompt-injection/data-instruction isolation;
- bounded fact count/token budget;
- conflict visibility;
- provenance sufficient for evidence-aware answers.

Repository/doc/external embedded instructions are data, not executable instructions.

## AI Router boundary
All model-assisted Project Memory operations route only through AI Router. Allowed assistance includes extraction, entity/relation extraction, embeddings, bounded similarity support, summarization of already-authorized facts and user-facing explanation.

AI cannot grant trust, self-confirm facts, bypass duplicate/conflict policy, broaden scope, change authority or directly mutate Project Memory storage outside SG contracts.

## Monarch authority
Verified Monarch operations, subject to Owner Security and audit, may include confirm, reject, correct-by-supersession, invalidate, restore where retention permits, and pin/mark canonical project decisions. Correction preserves history and provenance.

## Observability and diagnostics
Project Memory emits secret-safe bounded events for candidate creation, confirmation/rejection, duplicate suppression, conflict, supersession, retrieval counts, context-guard exclusions, source failures and index/rebuild failures.

Required diagnostics include at least:
```text
project_memory_health
project_memory_counts
project_memory_search_test
project_memory_duplicate_test
project_memory_conflict_test
project_memory_source_test
project_memory_context_test
project_memory_restart_continuity_test
```

Diagnostics do not dump raw private/sensitive memory into ordinary logs.

## Current/live-state rule
Project Memory is durable project knowledge, not a substitute for current verification. When truth may have changed, SG prefers live authoritative evidence when the required connector/tool exists. Stored facts remain provenance-bearing context and must be marked stale/uncertain when current verification is unavailable.

System Self Knowledge remains responsible for SG structured self-description. Project Memory stores project development facts/decisions but cannot redefine SG identity or authority.

## Security invariants
- Project Memory cannot grant identity, roles, permissions, ownership or resource authority.
- No direct AI-to-database memory mutation.
- No raw secrets in memory or retrieval prompts.
- No cross-project leakage.
- Raw chat is never automatically verified truth.
- External content remains data until source/trust policy evaluates it.
- Retrieval cannot bypass scope/privacy/Owner Security.
- Historical evidence cannot be presented as current live evidence without temporal qualification.
- Render is not a trusted live source until a real Render Connector exists and is verified.

## Acceptance definition
Project Memory 3.0 is DONE only when code, tests, CI and runtime evidence prove:
1. durable write;
2. durable read;
3. metadata retrieval;
4. semantic retrieval;
5. trusted-source ingestion for at least one real source;
6. candidate/confirmation policy;
7. deduplication;
8. conflict detection/resolution;
9. temporal history;
10. supersession;
11. namespaces;
12. bounded relations;
13. Context Guard;
14. bounded authorized AI context injection;
15. diagnostics;
16. audit/observability;
17. PostgreSQL restart continuity;
18. normal live SG requests automatically use Project Memory when relevant;
19. E2E proves `trusted source → durable memory → retrieval → guarded context → correct answer`;
20. SG answers current project-state questions from evidence, with uncertainty when live verification is unavailable.

## Relationship to Memory 2.0
Memory 2.0 remains the canonical general memory subsystem. Project Memory 3.0 is a specialized program inside its `Project Memory` domain and must reuse Memory 2.0 scope, privacy, provenance, trust, lifecycle, consolidation and recall boundaries instead of creating a parallel memory architecture.
