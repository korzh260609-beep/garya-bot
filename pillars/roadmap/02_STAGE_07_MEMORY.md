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
- Memory provider interface
- controlled read/write policy
- provenance and trust labels
- user/project/group scope isolation
- duplicate and conflict detection
- archive limits and retention hooks
- digest generation contract
- bounded restore before project work
- diagnostics and audit events

## Gates
- Raw dialogue never becomes confirmed memory automatically.
- Durable writes are state-changing actions.
- The Semantic Kernel requests memory through contracts and does not own storage.
- Restore must expose source, trust level and age.
- No cross-user or cross-group recall without explicit policy and permission.

## Acceptance criteria
SG can continue a project across sessions while distinguishing confirmed decisions, contextual summaries and raw history.
