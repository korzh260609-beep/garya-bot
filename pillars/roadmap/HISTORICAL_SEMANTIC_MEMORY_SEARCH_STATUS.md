# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH STATUS

## Current status

**HS1 — IMPLEMENTED / CI-VERIFIED / NOT CLOSED.**

**HS2 — IMPLEMENTED / CI-VERIFIED / NOT CLOSED.**

**HS3–HS6 — PLANNED / NOT CLOSED.**

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
- semantic candidate count is capped at 100, query/candidate text is bounded and the normal result record/character budgets are reapplied after reranking;
- invalid semantic output, unknown candidate IDs or AI Router failure fall back to the original deterministic Memory 2.0 recall result;
- production AI Router wiring is reuse-only through `src/ai/createProductionAI.js` and `src/ai/runtimeAIRouterBinding.js`;
- regression coverage is in `tests/memory2HybridSemanticRetrieval.test.js`, including paraphrase retrieval, authorization-before-AI, exact boost preservation and deterministic failure fallback;
- implementation commit `c8a073a7b65a23aa0601c093d3d81099076112a0` passed SG 2.1 CI #8479 on the exact commit.

HS1 and HS2 remain **NOT CLOSED** because the program status rule requires the consolidated security/live acceptance in HS6 before final closure.

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
3. HS3 — unified source orchestration across Conversation History / Memory 2.0 / PM3 / PDK4 / applicable Decision & Incident retrieval;
4. HS4 — unified cross-source ranking, deduplication, conflict and supersession merge;
5. HS5 — last occurrence, timeline, topic evolution and fact-history operations;
6. HS6 — security/adversarial regression, bounded-cost verification, exact-head CI and Telegram live acceptance.

## Canonical docs

- Architecture: `../architecture/HISTORICAL_SEMANTIC_MEMORY_SEARCH.md`
- Program/Roadmap: `HISTORICAL_SEMANTIC_MEMORY_SEARCH_PROGRAM.md`
- Workflow: `../workflow/HISTORICAL_SEMANTIC_MEMORY_SEARCH_WORKFLOW.md`
- Parent memory foundation: `MEMORY_2_0_ROADMAP.md`
- General context/memory roadmap: `02_CONTEXT_AND_MEMORY.md`

## Status rule

No HS stage may be marked CLOSED from documentation alone. Closure requires implementation evidence, exact-head SG 2.1 CI SUCCESS and the live acceptance required by HS6.
