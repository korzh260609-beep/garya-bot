# SG 2.1 — ARCHITECTURE INDEX

This directory defines how SG 2.1 is structured. Architecture does not contain roadmap order, implementation status, deployment history or runtime reports.

## Authority

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

## Canonical definition
SG 2.1 is one global transport-independent project system whose reasoning layer is provided by connected AI models. SG code organizes context, memory, sources, capabilities, identity, safety, execution and evidence.

## Canonical documents
1. `SG21_SYSTEM.md`
2. `SEMANTIC_KERNEL.md`
3. `CONTEXT_AND_MEMORY.md`
4. `DECISION_AND_ACTION_GATE.md`
5. `CAPABILITY_SYSTEM.md`
6. `IDENTITY_AND_SCOPE.md`
7. `OBSERVABILITY.md`
8. `TRANSPORTS_AND_AI_ROUTING.md`

## Core flow

```text
Input
→ Identity and Scope Resolution
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
- Connected AI models provide reasoning and may also execute specialized tasks.
- SG code does not imitate reasoning with keyword routing.
- Gates protect actions and do not become a second brain.
- Memory supplies bounded context and does not own SG identity.
- Commands are shortcuts; natural language is primary.
- Transports are thin adapters.
- Domain modules cannot redefine platform contracts.
