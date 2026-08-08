# SG 2.1 — SYSTEM ARCHITECTURE

## Purpose
SG 2.1 is one global transport-independent project system whose reasoning layer is provided by connected AI models. Models, agents, transports, tools, memory stores and controllers are replaceable components, not independent SG entities.

## Canonical processing flow

```text
Input
→ Identity and Scope Resolution
→ Language & Locale Context
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
- Transports contain no business logic, memory ownership, permissions policy or final response-language policy.
- Language & Locale Context enriches canonical context; it does not replace Semantic Kernel interpretation.
- Ordinary multilingual input remains available in its original form and is not required to pass through pre-translation.
- Preferred language is bound to global user context, not to one platform account.
- Memory provides bounded context and continuity; it is not SG identity or philosophy.
- Protected actions require identity, permission, scope, risk, cost and confirmation checks where applicable.
- Domain modules must not redefine the platform core.

## Core subsystems
1. Identity and Scope
2. Language & Locale Context
3. Semantic Kernel
4. Context and Memory
5. Decision Engine
6. Action Gate
7. Capability System
8. AI Routing
9. Transports
10. Observability
11. Automation and Agents
12. Domain Modules
