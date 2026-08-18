# SG 2.1 ROADMAP — BLOCK 2: CONTEXT AND MEMORY

## Goal
Provide bounded continuity without confusing raw dialogue, summaries, verified facts and durable decisions.

## Layers
1. Session Context
2. Confirmed User Memory
3. Confirmed Project Memory
4. Dialogue Archive
5. Topic Digest
6. External Evidence Context
7. Runtime State

## Deliverables
- ContextRequest and ContextBundle contracts
- memory provider interface
- controlled read/write policy
- provenance and trust labels
- user/project/group scope isolation
- duplicate and conflict detection
- archive limits and retention hooks
- digest generation contract
- bounded restore before project work
- diagnostics and audit events

## Memory 2.0 status

Memory 2.0 M1–M9 remains the completed canonical durable memory foundation. Historical/semantic search work is an additive extension and must not replace or duplicate that subsystem.

## Historical & Semantic Memory Search extension

The next memory-completeness program is HS1–HS6:

1. HS1 — Historical Query Planner;
2. HS2 — Memory 2.0 Hybrid Semantic Retrieval;
3. HS3 — Unified Historical Search Orchestrator;
4. HS4 — Unified Ranking, Deduplication, Conflict & Supersession;
5. HS5 — Timeline, First/Last Occurrence & Fact History;
6. HS6 — Security, Regression, Observability & Live Acceptance.

Target user behavior includes natural-language retrieval across authorized retained history by meaning, time and topic, including questions such as what was discussed months/years ago, first/last occurrence, topic evolution and fact history without requiring internal IDs or exact wording.

This extension reuses Conversation History, Memory 2.0, Temporal Service, Project Memory 3.0, PDK4, bounded response context, AI Router and existing Identity/Scope/Authority boundaries. No parallel RecallEngine or second memory store is permitted.

Canonical documents:
- `../architecture/HISTORICAL_SEMANTIC_MEMORY_SEARCH.md`
- `HISTORICAL_SEMANTIC_MEMORY_SEARCH_PROGRAM.md`
- `../workflow/HISTORICAL_SEMANTIC_MEMORY_SEARCH_WORKFLOW.md`

## Acceptance criteria
SG can continue work across sessions while preserving source, trust level, age and scope for restored context. Historical Semantic Memory Search is complete only when HS1–HS6 implementation, exact-head CI and required live acceptance prove semantic/time/topic retrieval across authorized long-term history.
