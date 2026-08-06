# SG 2.1 — ARCHITECTURE INDEX

This directory defines **how SG 2.1 is structured**. Architecture does not contain roadmap order, implementation status, deployment history or runtime reports.

## Authority

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

`pillars/DECISIONS.md` remains the highest active source for accepted global decisions.

## Canonical documents
1. `SG21_SYSTEM.md` — system boundary, hierarchy and canonical flow
2. `SEMANTIC_KERNEL.md` — meaning, intent and DecisionEnvelope
3. `CONTEXT_AND_MEMORY.md` — context layers, trust and continuity
4. `DECISION_AND_ACTION_GATE.md` — action classes and execution control
5. `CAPABILITY_SYSTEM.md` — capability contracts and normalized execution
6. `TRANSPORTS_AND_AI_ROUTING.md` — thin interfaces and model routing

## Core flow

```text
Input
→ Semantic Kernel
→ Context Resolution
→ Decision Envelope
→ Capability Selection
→ Action Classification
→ Action Gate
→ Execution or Answer
→ Response Composition
→ Observability
```

## Non-negotiable boundaries
- SG is one global intellectual system.
- Meaning is handled by the reasoning layer, not keyword routing.
- Gates protect actions and do not become SG brain.
- Memory supplies bounded context and does not own SG identity.
- Commands are shortcuts; natural language is the primary interface.
- Transports are thin adapters.
- AI models and agents are replaceable components.
- Domain modules cannot redefine platform contracts.

## Reading order
1. `pillars/DECISIONS.md`
2. `pillars/SG_ENTITY.md`
3. `pillars/SG_BEHAVIOR.md`
4. `pillars/PROJECT.md`
5. this index
6. `SG21_SYSTEM.md`
7. the relevant subsystem document
8. `pillars/roadmap/README.md`
9. `pillars/workflow/README.md`
