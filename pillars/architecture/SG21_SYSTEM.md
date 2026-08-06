# SG 2.1 — SYSTEM ARCHITECTURE

## Purpose
SG 2.1 is one global transport-independent project system whose reasoning layer is provided by connected AI models. Models, agents, transports, tools, memory stores and controllers are replaceable components, not independent SG entities.

## Canonical processing flow

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

## Hard boundaries
- Natural language is the primary interface.
- Commands are diagnostic and administrative shortcuts.
- Connected AI models provide reasoning and specialized execution.
- Rules and controllers constrain actions; they do not replace understanding.
- Transports contain no business logic, memory ownership or permissions policy.
- Memory provides bounded context and continuity; it is not SG identity or philosophy.
- Protected actions require identity, permission, scope, risk, cost and confirmation checks where applicable.
- Domain modules must not redefine the platform core.

## Core subsystems
1. Identity and Scope
2. Semantic Kernel
3. Context and Memory
4. Decision Engine
5. Action Gate
6. Capability System
7. AI Routing
8. Transports
9. Observability
10. Automation and Agents
11. Domain Modules
