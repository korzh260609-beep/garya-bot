# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH — CANONICAL ARCHITECTURE

## Status

Additive Memory 2.0 extension **IN PROGRESS / NOT CLOSED**. HS1 Historical Query Planner, HS2 Memory 2.0 Hybrid Semantic Retrieval, HS3 Unified Historical Search Orchestrator and HS4 Unified Ranking / Deduplication / Conflict / Supersession are implemented and CI-verified; HS5–HS6 remain planned. Final implementation status is determined by code, tests, exact-head CI and live runtime evidence.

## Purpose

Allow a user to ask SG naturally about any authorized stored conversation, fact, decision, incident or project-development topic across days, months or years without knowing exact words, dates, message IDs or memory IDs.

This extension MUST reuse the existing SG memory stack rather than creating a competing RecallEngine, second memory database or bypass path.

## Existing foundations that must be reused

- Memory 2.0 scope/privacy/lifecycle/provenance model;
- durable Conversation History and PostgreSQL message archive;
- existing AI-backed hierarchical Conversation History retrieval;
- Temporal Service;
- Project Memory 3.0;
- Project Development Knowledge 4.0;
- Decision / Incident memory where exposed through existing canonical retrieval seams;
- bounded response-context assembly;
- AI Router, cost logging and observability;
- Identity, `global_user_id`, Resource Authority, permissions and Action Gate boundaries.

## Canonical request flow

```text
natural-language user request
-> Historical Query Planner
-> Temporal Resolver
-> authorized Source Selector
-> source-local retrieval
   -> Conversation History semantic retrieval
   -> Memory 2.0 recall
   -> Project Memory 3.0 retrieval
   -> PDK4 retrieval
   -> Decision / Incident retrieval where applicable
-> Unified Ranking
-> Deduplication / Conflict / Supersession handling
-> optional Timeline / First / Last / Fact-History operation
-> Evidence Verification
-> bounded response context
-> normal user-facing SG answer
```

## Historical Query Planner

The planner converts a natural-language request into a bounded structured query without phrase-table routing.

It must resolve, where present:

- semantic subject/topic;
- temporal expression/range;
- operation;
- user/project/group/thread scope;
- relevant memory sources;
- optional entity/topic constraints;
- output mode.

Canonical operations:

- `search` — find relevant past material;
- `summarize-range` — summarize what happened in a period;
- `first-occurrence` — earliest supported discussion/fact occurrence;
- `last-occurrence` — latest supported occurrence;
- `timeline` — ordered development of a topic/fact;
- `fact-history` — provenance/lifecycle/supersession history of a fact.

Ambiguous interpretation must fail closed to a concise clarification when no single interpretation is sufficiently supported.

## Historical range rule

Explicit historical search is not governed by a fixed recent-context window such as 30 days.

The archive may span the full authorized retained history. Retrieval must remain bounded through:

- scope/time prefiltering;
- pagination;
- bounded chunks;
- hierarchical aggregation;
- capped evidence;
- AI Router budgets;
- caching where safe.

Ordinary conversational context may remain short and bounded independently.

## Memory 2.0 semantic retrieval rule

Memory 2.0 recall uses hybrid semantic retrieval while preserving deterministic and policy-first behavior.

The canonical implementation remains `createMemory2Service().recall()`; HS2 does **not** introduce a second RecallEngine. The original authorization and deterministic ranking implementation is retained as the core/fallback path. Semantic ranking is applied only to a bounded candidate set that has already passed the existing Memory 2.0 scope/privacy/lifecycle authorization boundary.

Ranking inputs include:

- exact key/entity/topic match;
- lexical relevance;
- semantic relevance;
- trust;
- confirmation state;
- confidence;
- lifecycle state;
- temporal fit/recency through the existing core signals;
- scope specificity;
- provenance quality.

Semantic analysis uses the approved SG AI Router only. The model may score only supplied authorized candidate IDs and cannot broaden scope or create evidence. Invalid output, unknown IDs or AI Router failure return the deterministic core recall result. Candidate count, query text, candidate text and final record/character output remain bounded.

HS2 implementation: `src/memory2/memory2.js`, `src/memory2/memory2Core.js`, `src/memory2/hybridSemanticRecall.js`, `tests/memory2HybridSemanticRetrieval.test.js`.

## Unified source orchestration

HS3 is implemented by `createUnifiedHistoricalSearchOrchestrator()` in `src/history/unifiedHistoricalSearchOrchestrator.js`. It consumes the HS1 plan through one transport-independent orchestration path and selects only requested canonical source families; it does not query every store unconditionally.

Canonical source reuse:

- Conversation History -> existing `retrieveLongTermConversationHistory()`;
- User / User×Group / Group / Thread / Topic Digest -> existing Memory 2.0 `recall()` with explicit layer selection and `includeHistory`;
- Project Memory 3.0 -> existing authorized Project Memory hybrid retrieval;
- PDK4 -> existing Development Query Integration;
- architecture decisions -> existing Project Memory retrieval restricted to `architecture-decision` facts;
- incidents -> existing Decision / Incident `findIncidentGuidance()` seam, preserving advisory-only semantics.

Examples:

- personal vehicle fact -> User Memory + personal Conversation History;
- project feature evolution -> Conversation History + Project Memory 3.0 + PDK4;
- group decision history -> authorized group/thread memory + matching group Conversation History;
- incident evolution -> Incident Memory + related project/development evidence.

If HS1 supplies no source hints, HS3 defaults only to personal Conversation History + User Memory; it does not broaden into group/project sources. Group/thread layers are selected only when matching resolved resource scope exists. Plan scope must exactly match the already-resolved request identity/project/group/thread scope before any source query executes.

Each source returns a normalized bounded source result with explicit `ok`, `empty`, `failed` or `omitted` state. Source-local failure is preserved and cannot be silently converted into empty success. HS3 source results remain independently available after HS4 merging.

HS3 implementation: `src/history/unifiedHistoricalSearchOrchestrator.js`, `tests/unifiedHistoricalSearchOrchestrator.test.js`; implementation HEAD `709cc33cfd898a4eaa660a90ecff69307940b986`, SG 2.1 CI #8485 SUCCESS on exact HEAD.

Source selection cannot broaden authorization.

## Unified ranking and merge

HS4 is implemented by deterministic `mergeHistoricalSearchResults()` in `src/history/unifiedHistoricalResultMerger.js` and is invoked by the canonical `createUnifiedHistoricalSearchOrchestrator().search()` path after all selected source-local retrieval has completed.

The orchestrator returns both:

- original normalized HS3 `sources`, including explicit source failures/omissions;
- one bounded HS4 `merged` evidence set for downstream reasoning/output.

Results from different stores are ranked using:

- source-local relevance / semantic relevance;
- temporal fit against the requested historical range;
- exact entity/topic fit;
- scope specificity;
- trust;
- confirmation state;
- confidence;
- provenance quality;
- lifecycle/currentness.

HS4 is deterministic and performs no model call. It receives only evidence that already passed HS1/HS3 source/scope selection and source-local authorization, therefore ranking cannot broaden authorization.

Duplicate representations are suppressed only with bounded evidence-backed equivalence signals such as shared source/provenance references, same explicit entity plus same value, safe normalized-content equivalence for the same/no explicit entity, or topic-digest source references. A suppressed representation is not discarded: its source reference is retained in `duplicateEvidence`.

Identical text attached to two different explicit entities is **not** sufficient to merge them.

HS4 implementation: `src/history/unifiedHistoricalResultMerger.js`, integration in `src/history/unifiedHistoricalSearchOrchestrator.js`, regression suite `tests/unifiedHistoricalResultMerger.test.js`; implementation HEAD `7712e2822f7cf7b658cea906ca0ba4a86b4b9a2b`, SG 2.1 CI #8501 SUCCESS on exact HEAD.

## Conflict and supersession rule

Historical search preserves the distinction between:

- what was believed/reported at a past time;
- what later changed;
- what is current now.

A later value may supersede an older value without erasing the historical record.

Memory 2.0 `supersededBy` and PM3/PDK4 `successorMemoryId` are propagated into the normalized historical result contract. HS4 exposes supersession chains and does not rewrite source lifecycle state.

For a historical question, old superseded evidence may be correct for the requested date and remains eligible under authorized history mode. For a current-state query, active/current supported evidence receives a stronger lifecycle/currentness score than superseded/expired evidence.

Contradictory current values are preserved as explicit unresolved conflict groups. HS4 does not invent a winner and does not replace PM3's existing authority-controlled conflict resolution. A supersession chain is treated as historical evolution rather than flattened into a current contradiction.

## Timeline rule

Timeline output is built from source timestamps and provenance, not model invention.

Canonical shape:

```text
date/time
-> supported event/discussion/fact
-> decision or conclusion where evidenced
-> later change/supersession where evidenced
-> current state where requested
```

Timeline may group by day/week/month when requested, but grouping must not fabricate events for empty periods.

## First / last occurrence rule

`first-occurrence` and `last-occurrence` must identify the earliest/latest source-verified material that actually discusses or establishes the requested subject.

A keyword mention alone is insufficient if semantic verification shows the subject was not actually discussed.

## Fact-history rule

For a durable fact SG must be able to expose, when authorized:

- first source occurrence;
- memory creation time;
- source/provenance;
- trust/confidence at each state;
- confirmation changes;
- supersession chain;
- current/expired/archived state;
- last supported update.

## Temporal reasoning

The Temporal Service remains the canonical resolver for absolute and relative human time expressions.

The extension must support at least:

- exact date;
- date range;
- month/year;
- last month / last year;
- relative expressions such as “about two months ago”;
- seasonal/broad periods where resolvable;
- event-relative queries only when a referenced event can first be resolved to evidence-backed time bounds.

## Security invariants

Authorization is applied before semantic content reaches the model.

Mandatory pre-retrieval boundaries:

- `global_user_id` isolation;
- project scope isolation;
- group scope isolation;
- thread scope isolation;
- privacy class;
- current workspace/resource permissions where required.

The system must never retrieve a broad multi-user corpus and rely on an AI model to remove unauthorized records afterward.

## Evidence and provenance

Every user-facing historical claim must remain traceable internally to one or more authorized source records.

The normal user response should show human-readable dates/topics/summaries, not internal IDs or scores. Internal IDs remain available only to diagnostics/technical inspection paths.

## Cost and boundedness

Deterministic scope/time filtering occurs before expensive semantic processing.

Large archive processing must reuse hierarchical bounded retrieval and AI Router accounting. Every AI call remains logged with provider/model/reason/cost/trace according to existing SG policy.

HS4 itself makes no AI calls and is bounded to a capped normalized input/result set.

## Program

Implementation is split into HS1–HS6:

1. HS1 — Historical Query Planner — implemented / CI-verified;
2. HS2 — Memory 2.0 Hybrid Semantic Retrieval — implemented / CI-verified;
3. HS3 — Unified Historical Search Orchestrator — implemented / CI-verified;
4. HS4 — Unified Ranking, Deduplication, Conflict & Supersession — implemented / CI-verified;
5. HS5 — Timeline, First/Last Occurrence & Fact History — planned;
6. HS6 — Security, Regression, Observability & Live Acceptance — planned.

HS1–HS4 remain **NOT CLOSED** until HS6 consolidated security/live acceptance satisfies the program closure rule.

Roadmap: `../roadmap/HISTORICAL_SEMANTIC_MEMORY_SEARCH_PROGRAM.md`.
Workflow: `../workflow/HISTORICAL_SEMANTIC_MEMORY_SEARCH_WORKFLOW.md`.
