# SG 2.1 — SYSTEM ARCHITECTURE

## Purpose
SG 2.1 is one global intellectual system. Models, agents, transports, tools, memory stores and controllers are replaceable components of SG, not independent SG entities.

## Canonical processing flow

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

## Architectural hierarchy

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

## Hard boundaries
- Natural language is the primary interface.
- Commands are diagnostic and administrative shortcuts.
- The reasoning layer understands meaning.
- Rules and controllers constrain actions; they do not replace understanding.
- Transports contain no business logic, memory ownership or permissions policy.
- Memory provides bounded context and continuity; it is not SG identity or philosophy.
- External AI models are replaceable executors.
- Protected actions require permission, scope, risk, cost and confirmation checks where applicable.
- Domain modules must not redefine the platform core.

## Core subsystems
1. Semantic Kernel
2. Context and Memory
3. Decision and Safety
4. Capability System
5. AI Routing
6. Transports
7. Observability
8. Automation and Agents
9. Domain Modules
