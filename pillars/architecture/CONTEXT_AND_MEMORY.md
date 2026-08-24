# SG 2.1 — CONTEXT AND MEMORY

## Layers
- Session Context
- Confirmed User Memory
- Confirmed Project Memory
- Dialogue Archive
- Topic Digest
- External Evidence
- Runtime State

## Trust order

```text
accepted monarch decision recorded in DECISIONS.md
→ verified repository/runtime facts
→ confirmed project memory
→ confirmed user memory
→ sourced external evidence
→ digests and summaries
→ raw dialogue
```

A new conversational instruction may initiate a proposed decision, but it does not become durable architectural truth until recorded in `DECISIONS.md`.

## Rules
- Raw dialogue is never confirmed memory automatically.
- Durable writes are controlled state-changing actions.
- Every durable memory item requires provenance, scope, timestamp and confidence.
- Conflicts are detected before overwrite.
- Restore is bounded and labels context type and trust level.
- Memory providers implement contracts and may be replaced without changing semantic logic.
- User, project and group scopes remain isolated.
