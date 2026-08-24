# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH STATUS

## Current status

**HS1 — IMPLEMENTED / CI-VERIFIED / NOT CLOSED.**

**HS2 — IMPLEMENTED / CI-VERIFIED / NOT CLOSED.**

**HS3 — IMPLEMENTED / CI-VERIFIED / NOT CLOSED.**

**HS4 — IMPLEMENTED / CI-VERIFIED / NOT CLOSED.**

**HS5 — IMPLEMENTED / CI-VERIFIED / NOT CLOSED.**

**HS6 — IMPLEMENTED / CI-VERIFIED / LIVE ACCEPTANCE PENDING / NOT CLOSED.**

HS1 implementation evidence:

- transport-independent `src/history/historicalQueryPlanner.js`;
- semantic planning only through SG AI Router;
- canonical operations: `search`, `summarize-range`, `first-occurrence`, `last-occurrence`, `timeline`, `fact-history`;
- semantic subject, entity constraints, source hints and output mode extraction;
- canonical Temporal Service reuse for single expressions and bounded start/end ranges;
- Identity / project / group / thread scope accepted only from the already-resolved request, never from model output;
- source hints are bounded to canonical source types and do not grant authorization;
- unsupported, ambiguous, low-confidence and unresolved-time interpretations fail closed to clarification;
- no phrase-table routing and no direct model call bypass;
- regression coverage in `tests/historicalQueryPlanner.test.js`;
- implementation commit `d380d935f1384dcaad1e44f9c8da1169cb94f8e3` passed SG 2.1 CI #8475.

HS2 implementation evidence:

- canonical Memory 2.0 retrieval remains `createMemory2Service().recall()`; no second RecallEngine was introduced;
- the existing deterministic Memory 2.0 implementation is preserved in `src/memory2/memory2Core.js` and wrapped by the canonical `src/memory2/memory2.js` export;
- scope/privacy/lifecycle authorization remains inside the existing core `authorizedCandidates()` stage before semantic content is sent to AI;
- semantic reranking is implemented in `src/memory2/hybridSemanticRecall.js` and receives only a bounded already-authorized candidate set;
- semantic relevance uses SG AI Router with reason `memory2-hybrid-semantic-retrieval`; no direct provider/model bypass is used;
- exact-key and lexical scores remain part of the combined score and exact-key boosts are preserved;
- combined ranking also considers confidence, provenance completeness and lifecycle state in addition to the existing trust, confirmation, scope specificity and recency signals;
- semantic candidate count is capped at 100, query/candidate text is bounded and the normal result record/character output remains bounded;
- invalid semantic output, unknown candidate IDs or AI Router failure fall back to the original deterministic Memory 2.0 recall result;
- production AI Router wiring is reuse-only through `src/ai/createProductionAI.js` and `src/ai/runtimeAIRouterBinding.js`;
- regression coverage is in `tests/memory2HybridSemanticRetrieval.test.js`, including paraphrase retrieval, authorization-before-AI, exact boost preservation and deterministic failure fallback;
- implementation commit `c8a073a7b65a23aa0601c093d3d81099076112a0` passed SG 2.1 CI #8479 on the exact commit.

HS3 implementation evidence:

- one transport-independent orchestration path: `src/history/unifiedHistoricalSearchOrchestrator.js`;
- orchestration consumes the HS1 plan and checks exact equality with the resolved request `globalUserId` / project / group / thread scope before source access;
- absent source hints default only to personal Conversation History + User Memory, never broad shared/project retrieval;
- Conversation History reuses the existing hierarchical semantic retriever;
- personal, user×group, group, thread and topic-digest retrieval reuse Memory 2.0 hybrid `recall()` with explicit layers and existing authorization/privacy/lifecycle checks;
- PM3 uses existing authorized Project Memory hybrid retrieval;
- PDK4 uses existing Development Query Integration;
- architecture decisions use the existing Project Memory retrieval seam restricted to decision facts;
- incidents use existing Decision / Incident `findIncidentGuidance()` with advisory-only semantics preserved;
- every selected source is normalized into a bounded source contract and reports explicit `ok`, `empty`, `failed` or `omitted` state;
- failures are preserved per source, so a mixed request may return `partial` without inventing evidence;
- HS3 source-local normalized results are retained after HS4 and remain independently inspectable;
- regression coverage in `tests/unifiedHistoricalSearchOrchestrator.test.js`: personal default selection, group/thread resource binding, Conversation History + PM3 + PDK4 composition, scope-broadening rejection, explicit source failure, temporal filtering and incident advisory semantics;
- implementation code commit `d03e059833326ac8a9274e3b2ea43f01190cc6a5`, regression commit / implementation HEAD `709cc33cfd898a4eaa660a90ecff69307940b986`;
- SG 2.1 CI #8485 passed SUCCESS on exact implementation HEAD `709cc33cfd898a4eaa660a90ecff69307940b986`.

HS4 implementation evidence:

- deterministic cross-source merger: `src/history/unifiedHistoricalResultMerger.js`;
- `createUnifiedHistoricalSearchOrchestrator().search()` now returns the original HS3 `sources` plus one bounded HS4 `merged` evidence set;
- ranking combines source-local relevance, temporal fit, exact/entity fit, scope specificity, trust, confirmation, confidence, provenance quality and lifecycle/currentness;
- current-state ranking penalizes superseded/expired evidence while explicit historical ranges keep superseded evidence eligible;
- duplicate suppression uses shared source/provenance references, same entity+value, bounded normalized-content equivalence and digest source references; it does not merge identical text across different explicit entities;
- every suppressed duplicate remains traceable through `duplicateEvidence` source references;
- unresolved contradictory current values remain explicit conflict groups; HS4 does not invent a winner or bypass PM3 owner-authority conflict resolution;
- Memory 2.0 `supersededBy` and PM3/PDK4 `successorMemoryId` are propagated into the normalized contract and exposed as supersession chains without deleting old evidence;
- source failures/omissions are not flattened: a request remains `partial` even when available sources can be ranked/merged successfully;
- HS4 is deterministic and makes no AI/model call, so it cannot broaden authorization or create evidence;
- regression coverage in `tests/unifiedHistoricalResultMerger.test.js`: cross-source duplicate suppression, source-reference preservation, unresolved conflicts, supersession history, current-state preference, false-dedup guard and partial-source integration;
- implementation HEAD `7712e2822f7cf7b658cea906ca0ba4a86b4b9a2b` passed SG 2.1 CI #8501 SUCCESS on exact HEAD; migrations, security gate, `npm run check`, web start, worker start and diagnostics all passed.

HS1–HS4 remain **NOT CLOSED** because the program status rule requires consolidated security/live acceptance in HS6 before final closure.

This program is the approved additive completion layer for natural-language historical memory search across the existing SG 2.1 memory stack.

Memory 2.0 M1–M9 remains **CLOSED** and is not replaced or reopened by this program.

## Existing implementation foundation confirmed by audit

Already present and intended for reuse:

- durable PostgreSQL Conversation History;
- AI-backed hierarchical Conversation History retrieval;
- semantic history operations for `search`, `summarize-range` and `first-occurrence`;
- temporal range filtering and pagination across retained history;
- Memory 2.0 scoped durable records;
- `global_user_id`, project/group/thread isolation;
- Memory 2.0 trust, confidence, lifecycle, provenance, conflict and supersession metadata;
- topic digests;
- Project Memory 3.0;
- Project Development Knowledge 4.0;
- bounded response-context assembly;
- AI Router / cost / observability boundaries.

## Gaps to close

1. HS1 — implemented and CI-verified; pending HS6 live acceptance before CLOSED;
2. HS2 — implemented and CI-verified; pending HS6 consolidated security/live acceptance before CLOSED;
3. HS3 — implemented and CI-verified; pending HS6 consolidated security/live acceptance before CLOSED;
4. HS4 — implemented and CI-verified; pending HS6 consolidated security/live acceptance before CLOSED;
5. HS5 — implemented and CI-verified; pending HS6 live acceptance before CLOSED;
6. HS6 — implementation and exact-head CI complete; Telegram live acceptance remains pending.

## HS6 implementation evidence

- `tests/historicalSemanticMemoryRestartContinuity.test.js` proves PostgreSQL Memory 2.0 write, database-client restart, recall and hydration of `confirmed` plus `provenance.sourceTimestamp`.
- `tests/longTermConversationHistory.test.js` is the existing deterministic equivalent for large archive / hierarchical retrieval: all keyset pages, composite cursor, hierarchical processing and bounded verified evidence.
- Exact implementation HEAD `3c3e0cafdfc0f974a5b704d073a0cf564af72ba0`: SG 2.1 CI #8547 SUCCESS.
- Telegram live acceptance is intentionally a separate next stage.

## Canonical docs

- Architecture: `../architecture/HISTORICAL_SEMANTIC_MEMORY_SEARCH.md`
- Program/Roadmap: `HISTORICAL_SEMANTIC_MEMORY_SEARCH_PROGRAM.md`
- Workflow: `../workflow/HISTORICAL_SEMANTIC_MEMORY_SEARCH_WORKFLOW.md`
- Parent memory foundation: `MEMORY_2_0_ROADMAP.md`
- General context/memory roadmap: `02_CONTEXT_AND_MEMORY.md`

## Status rule

No HS stage may be marked CLOSED from documentation alone. Closure requires implementation evidence, exact-head SG 2.1 CI SUCCESS and the live acceptance required by HS6.
