# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH PROGRAM

## Status

**IN PROGRESS / NOT CLOSED.** HS1, HS2, HS3 and HS4 are implemented and CI-verified. HS5–HS6 remain planned. This is an additive Memory 2.0 extension. M1–M9 remain CLOSED and must not be reopened or replaced.

## Goal

Complete SG historical memory so an authorized user can ask naturally about conversations, facts, decisions, incidents and project-development topics across days, months or years by meaning, time, topic and scope without knowing exact wording or internal IDs.

## Reuse-first rule

Do not create a second memory subsystem, second RecallEngine, second scheduler/worker, second identity model or duplicate stores.

Required reuse:

- Memory 2.0;
- durable Conversation History;
- existing hierarchical AI-backed history retrieval;
- Temporal Service;
- Project Memory 3.0;
- Project Development Knowledge 4.0;
- Decision / Incident memory through canonical retrieval seams;
- bounded response context;
- Identity / Scope / Resource Authority / permissions;
- AI Router / observability / cost accounting.

## Program order

```text
HS1 Historical Query Planner [IMPLEMENTED / CI-VERIFIED]
-> HS2 Memory 2.0 Hybrid Semantic Retrieval [IMPLEMENTED / CI-VERIFIED]
-> HS3 Unified Historical Search Orchestrator [IMPLEMENTED / CI-VERIFIED]
-> HS4 Ranking / Dedup / Conflict / Supersession [IMPLEMENTED / CI-VERIFIED]
-> HS5 Timeline / First / Last / Fact History
-> HS6 Security / Regression / Observability / Live Acceptance
```

---

# HS1 — Historical Query Planner

## Goal

Convert free-form historical questions into a bounded structured search plan.

## Required scope

- semantic subject/topic extraction;
- temporal expression/range extraction;
- operation selection;
- scope/source selection hints;
- ambiguity handling;
- no phrase-table routing.

## Canonical operations

- `search`;
- `summarize-range`;
- `first-occurrence`;
- `last-occurrence`;
- `timeline`;
- `fact-history`.

## Acceptance criteria

- [x] “Что мы обсуждали месяц назад про машину?” resolves topic + relative time + search;
- [x] “Когда я впервые говорил про Haldex?” resolves first-occurrence;
- [x] “Покажи как менялось решение по памяти СГ за год” resolves timeline + range;
- [x] unsupported/ambiguous intent fails closed to a concise clarification;
- [x] no internal IDs are required from the user;
- [x] interpretation is transport-independent.

Implementation evidence: `src/history/historicalQueryPlanner.js`, `tests/historicalQueryPlanner.test.js`; implementation commit `d380d935f1384dcaad1e44f9c8da1169cb94f8e3`, SG 2.1 CI #8475 SUCCESS.

---

# HS2 — Memory 2.0 Hybrid Semantic Retrieval

## Goal

Upgrade Memory 2.0 from primarily lexical/token recall to hybrid semantic retrieval while preserving policy-first deterministic filtering.

## Required scope

- exact key/entity/topic boosts;
- lexical relevance;
- semantic relevance through approved AI Router/retrieval infrastructure;
- trust/confirmation/confidence weighting;
- lifecycle/temporal fit;
- scope specificity;
- bounded candidate/evidence limits;
- cost logging.

## Acceptance criteria

- [x] semantically equivalent wording finds the same authorized fact without exact token overlap;
- [x] authorization occurs before semantic content reaches AI;
- [x] superseded/expired facts remain excluded from ordinary recall but available in authorized historical mode through the existing `includeHistory` contract;
- [x] AI failure has a bounded deterministic fallback;
- [x] no direct model calls bypass AI Router;
- [x] user/group/thread/project isolation regression remains green.

Implementation evidence:

- canonical entry remains `createMemory2Service().recall()`; no parallel RecallEngine;
- deterministic core and authorization boundary remain in `src/memory2/memory2Core.js`;
- hybrid semantic reranking is `src/memory2/hybridSemanticRecall.js`;
- semantic processing receives only bounded results returned by the existing authorized core recall;
- exact/lexical ranking signals are retained and combined with semantic relevance plus confidence/provenance/lifecycle evidence signals;
- SG AI Router is used with normal policy/telemetry/cost handling and deterministic fallback on route/output failure;
- regression suite: `tests/memory2HybridSemanticRetrieval.test.js`;
- implementation commit `c8a073a7b65a23aa0601c093d3d81099076112a0`, SG 2.1 CI #8479 SUCCESS on exact commit.

HS2 is implemented and CI-verified but remains **NOT CLOSED** until HS6 consolidated security/live acceptance under the program closure rule.

---

# HS3 — Unified Historical Search Orchestrator

## Goal

Select and query only the relevant canonical memory/history sources for one user request.

## Candidate sources

- Conversation History;
- User Memory;
- User × Group Memory;
- Group / Thread Memory;
- Topic Digest;
- Project Memory 3.0;
- PDK4;
- Decision / Incident memory where applicable.

## Acceptance criteria

- [x] personal questions do not query unrelated shared/project stores by default;
- [x] project-development questions can combine Conversation History + PM3 + PDK4;
- [x] group/thread questions remain resource-bound;
- [x] source selection never broadens authorization;
- [x] one request returns normalized source results through one orchestration contract;
- [x] every source failure is explicit and cannot be converted into invented evidence.

Implementation evidence:

- one orchestration entry: `createUnifiedHistoricalSearchOrchestrator().search()` in `src/history/unifiedHistoricalSearchOrchestrator.js`;
- HS1 plan scope must exactly equal resolved request identity/project/group/thread scope before any source is queried;
- no-source-hint fallback is bounded to Conversation History + User Memory only;
- Conversation History reuses `retrieveLongTermConversationHistory()`;
- personal/shared/topic facts reuse Memory 2.0 `recall()` with explicit authorized layers and `includeHistory: true`;
- PM3 reuses authorized Project Memory hybrid retrieval;
- PDK4 reuses Development Query Integration;
- decision search reuses Project Memory retrieval restricted to `architecture-decision` facts;
- incident search reuses canonical `findIncidentGuidance()` and preserves advisory-only semantics;
- normalized source results preserve `ok`, `empty`, `failed` and `omitted` states with bounded evidence;
- source-local normalized results remain available unchanged after HS4 merge;
- regression suite: `tests/unifiedHistoricalSearchOrchestrator.test.js` covers personal default selection, group/thread scope, PM3+PDK4 mixed retrieval, fail-closed scope mismatch, explicit source failure, temporal filtering and incident advisory semantics;
- implementation HEAD `709cc33cfd898a4eaa660a90ecff69307940b986`, SG 2.1 CI #8485 SUCCESS on exact HEAD.

HS3 is implemented and CI-verified but remains **NOT CLOSED** until HS6 consolidated security/live acceptance under the program closure rule.

---

# HS4 — Unified Ranking, Deduplication, Conflict & Supersession

## Goal

Merge heterogeneous results into one evidence-preserving historical answer set.

## Ranking factors

- semantic/source-local relevance;
- temporal match;
- exact entity/key match;
- scope specificity;
- trust;
- confirmation;
- confidence;
- provenance quality;
- lifecycle/currentness where relevant.

## Acceptance criteria

- [x] duplicate representations from message + memory + digest do not appear as repeated user results;
- [x] conflicting facts remain visible as conflicts;
- [x] supersession chains distinguish past truth-state from current state;
- [x] historical queries may return superseded evidence when it was valid/reported in the requested period;
- [x] current-state queries prefer current supported values;
- [x] merge retains source references for verification.

Implementation evidence:

- deterministic cross-source merge is `mergeHistoricalSearchResults()` in `src/history/unifiedHistoricalResultMerger.js`;
- canonical `createUnifiedHistoricalSearchOrchestrator().search()` returns both original HS3 `sources` and bounded HS4 `merged` evidence;
- ranking combines relevance, temporal fit, entity fit, scope specificity, trust, confirmation, confidence, provenance quality and lifecycle/currentness;
- duplicate suppression requires evidence-backed equivalence: shared source/provenance reference, same explicit entity+value, safe normalized content for the same/no explicit entity, or digest source linkage;
- identical text across different explicit entities is not treated as a duplicate;
- suppressed duplicates remain traceable through `duplicateEvidence`;
- contradictory current values stay explicit `unresolved` conflicts and HS4 never invents an authority winner;
- Memory 2.0 `supersededBy` and PM3/PDK4 `successorMemoryId` are propagated to supersession chains while historical records remain retrievable;
- current-state ranking favors active/current supported evidence; explicit historical ranges keep superseded evidence eligible;
- source-local `failed`/`omitted` states remain explicit and keep the overall result `partial` even when available evidence merges successfully;
- HS4 performs no AI call and cannot expand authorization;
- regression suite: `tests/unifiedHistoricalResultMerger.test.js`;
- implementation HEAD `7712e2822f7cf7b658cea906ca0ba4a86b4b9a2b`, SG 2.1 CI #8501 SUCCESS on exact HEAD; migrations, security gate, `npm run check`, web start, worker start and diagnostics all passed.

HS4 is implemented and CI-verified but remains **NOT CLOSED** until HS6 consolidated security/live acceptance under the program closure rule.

---

# HS5 — Timeline, First/Last Occurrence & Fact History

## Goal

Provide chronological and provenance-aware historical reasoning over stored evidence.

## Required scope

- timeline construction;
- first occurrence;
- last occurrence;
- first confirmed fact;
- latest supported update;
- fact lifecycle history;
- topic history;
- event-relative time where evidence can resolve the anchor event.

## Acceptance criteria

- [ ] “когда впервые” returns earliest source-verified occurrence;
- [ ] “когда последний раз” returns latest supported occurrence;
- [ ] “как менялось” returns chronological evidence-backed evolution;
- [ ] timeline never invents events for empty periods;
- [ ] fact history exposes provenance/trust/confirmation/supersession state internally;
- [ ] user-facing output stays human-readable and does not expose IDs/scores by default.

---

# HS6 — Security, Regression, Observability & Live Acceptance

## Goal

Close the extension only after end-to-end safety, durability and Telegram acceptance are proven.

## Mandatory regression matrix

- [ ] historical search one year back;
- [ ] semantic paraphrase without exact words;
- [ ] exact month/range;
- [ ] approximate relative time;
- [ ] first occurrence;
- [ ] last occurrence;
- [ ] timeline;
- [ ] fact supersession/history;
- [ ] cross-source merge;
- [ ] duplicate suppression;
- [ ] ambiguity clarification;
- [ ] AI failure fallback;
- [ ] large archive hierarchical retrieval;
- [ ] restart continuity;
- [ ] user isolation;
- [ ] group isolation;
- [ ] thread isolation;
- [ ] project isolation;
- [ ] unauthorized memory never reaches semantic processing;
- [ ] no secrets/raw private content in telemetry;
- [ ] AI Router provider/model/reason/cost/trace logging remains complete.

## Live acceptance examples

After deployment, Telegram acceptance must include natural requests equivalent to:

- “Что я говорил месяц назад?”
- “Найди нашу тему про мои машины.”
- “Когда впервые я говорил про Freelander?”
- “Что мы обсуждали прошлым летом?”
- “Покажи развитие памяти СГ по месяцам.”
- “Как изменялось решение по автоматизации?”

A two-user/group test must verify that unauthorized memory never crosses identity or workspace boundaries.

## Completion definition

HS1–HS6 are CLOSED only when implementation, exact-head CI and required live acceptance prove the complete historical semantic path. Documentation alone never closes a block.

Architecture: `../architecture/HISTORICAL_SEMANTIC_MEMORY_SEARCH.md`.
Workflow: `../workflow/HISTORICAL_SEMANTIC_MEMORY_SEARCH_WORKFLOW.md`.
Memory foundation: `MEMORY_2_0_ROADMAP.md`.
