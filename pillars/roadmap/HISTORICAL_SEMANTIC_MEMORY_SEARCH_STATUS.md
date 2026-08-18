# SG 2.1 — HISTORICAL & SEMANTIC MEMORY SEARCH STATUS

## Current status

**HS1–HS6 — PLANNED / NOT CLOSED.**

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

1. HS1 — unified Historical Query Planner;
2. HS2 — true hybrid semantic retrieval for Memory 2.0 beyond primarily lexical/token ranking;
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
