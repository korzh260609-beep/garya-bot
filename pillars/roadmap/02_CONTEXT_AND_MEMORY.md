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

## Acceptance criteria
SG can continue work across sessions while preserving source, trust level, age and scope for restored context.
