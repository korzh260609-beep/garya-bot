# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH — CANONICAL ARCHITECTURE

## Status

Planned additive Memory 2.0 extension. This document defines the target architecture only; implementation status is determined by code, tests, exact-head CI and live runtime evidence.

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

Memory 2.0 recall must evolve from primarily lexical/token scoring into hybrid semantic retrieval while preserving deterministic and policy-first behavior.

Ranking inputs may include:

- exact key/entity/topic match;
- lexical relevance;
- semantic relevance;
- trust;
- confirmation state;
- confidence;
- lifecycle state;
- temporal fit;
- freshness/recency when relevant;
- scope specificity;
- provenance quality.

Semantic analysis must use the approved AI Router or approved retrieval infrastructure only. No direct model bypass is allowed.

## Unified source orchestration

The orchestrator selects only sources relevant to the request. It must not query every store unconditionally.

Examples:

- personal vehicle fact -> User Memory + personal Conversation History;
- project feature evolution -> Conversation History + Project Memory 3.0 + PDK4;
- group decision history -> authorized group/thread memory + matching group Conversation History;
- incident evolution -> Incident Memory + related project/development evidence.

Source selection cannot broaden authorization.

## Unified ranking and merge

Results from different stores must be normalized into one internal result contract containing at least:

- source type/layer;
- source ID;
- timestamp/range;
- scope;
- content/summary;
- semantic score;
- temporal score;
- trust/confidence;
- confirmation/lifecycle state;
- provenance;
- supersession/conflict references;
- verification state.

Duplicate representations of the same event/fact must be merged rather than repeated to the user.

## Conflict and supersession rule

Historical search must preserve the distinction between:

- what was believed/reported at a past time;
- what later changed;
- what is current now.

A later value may supersede an older value without erasing the historical record.

For a historical question, old superseded evidence may be correct for the requested date and must remain retrievable under authorized history mode.

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

## Program

Implementation is split into HS1–HS6:

1. HS1 — Historical Query Planner;
2. HS2 — Memory 2.0 Hybrid Semantic Retrieval;
3. HS3 — Unified Historical Search Orchestrator;
4. HS4 — Unified Ranking, Deduplication, Conflict & Supersession;
5. HS5 — Timeline, First/Last Occurrence & Fact History;
6. HS6 — Security, Regression, Observability & Live Acceptance.

Roadmap: `../roadmap/HISTORICAL_SEMANTIC_MEMORY_SEARCH_PROGRAM.md`.
Workflow: `../workflow/HISTORICAL_SEMANTIC_MEMORY_SEARCH_WORKFLOW.md`.
Memory foundation: `MEMORY_2_0.md`.
