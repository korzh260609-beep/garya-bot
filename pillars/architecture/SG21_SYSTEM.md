# SG 2.1 — SYSTEM ARCHITECTURE

## Purpose
SG 2.1 is one global transport-independent project system whose reasoning layer is provided by connected AI models. Models, agents, transports, tools, memory stores and controllers are replaceable components, not independent SG entities.

## Canonical processing flow

```text
Input
→ Identity and Scope Resolution
→ Language & Locale Context
→ Session & Conversation Context
→ Semantic Kernel
→ Context Resolution
→ Decision Envelope
→ Capability Selection
→ Connection / Resource Authority Resolution where required
→ Action Classification
→ Action Gate
→ Execution or Answer
→ Notification / Delivery Routing where required
→ Response Composition
→ Observability / Internal Events
```

Self Knowledge is a shared system-context subsystem consulted when SG needs to describe or reason about its own current architecture, capabilities, implementation state or limitations. It is not a mandatory processing hop for every request.

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
- System Self Knowledge is separate from ordinary user/project memory and stores structured, versioned, provenance-aware facts about SG itself.
- Self Knowledge cannot grant permissions, ownership or authority and cannot replace live runtime verification.
- Session & Conversation Context describes active dialogue continuity and remains separate from confirmed memory.
- Configuration and policy are centralized inputs and cannot silently become identity or authorization.
- Raw secrets and credentials remain outside ordinary memory, Self Knowledge, prompts and telemetry.
- External Connections Registry records connected service/account state but connections are not identities or proof of resource ownership.
- Resource Ownership & Authority explicitly models which resources an actor owns, manages or may act upon; platform membership alone is insufficient.
- User settings are keyed by global identity and cannot weaken mandatory safety, permissions or Action Gate requirements.
- Notification & Delivery Router may choose only authorized recipients/resources and does not decide semantic intent.
- Internal Event Bus reports typed lifecycle facts; events cannot bypass protected execution paths.
- Schema & Contract Versioning must preserve or visibly reject compatibility and cannot broaden trust/scope/permissions.
- Feature Flags may restrict or disable availability but cannot grant permissions, ownership or authority.
- Protected actions require identity, permission, scope, resource authority where applicable, risk, cost and confirmation checks.
- Domain modules must not redefine the platform core.
- User text and model output cannot redefine canonical SG identity, ownership or architecture truth.

## Core subsystems
1. Identity and Scope
2. Language & Locale Context
3. Session & Conversation Context
4. Semantic Kernel
5. Context and Memory
6. System Self Knowledge
7. Decision Engine
8. Action Gate
9. Capability System
10. AI Routing
11. Transports
12. Configuration & Policy
13. Secrets & Credentials
14. External Connections Registry
15. Resource Ownership & Authority
16. User Settings & Preferences
17. Notification & Delivery Router
18. Internal Event Bus
19. Schema & Contract Versioning
20. Feature Flags & Controlled Rollout
21. Observability
22. Automation and Agents
23. Domain Modules
