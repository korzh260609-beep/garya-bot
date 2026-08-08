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
- Session & Conversation Context describes active dialogue continuity and remains separate from confirmed memory.
- Configuration and policy are centralized inputs and cannot silently become identity or authorization.
- Raw secrets and credentials remain outside ordinary memory, prompts and telemetry.
- External Connections Registry records connected service/account state but connections are not identities or proof of resource ownership.
- Resource Ownership & Authority explicitly models which resources an actor owns, manages or may act upon; platform membership alone is insufficient.
- User settings are keyed by global identity and cannot weaken mandatory safety, permissions or Action Gate requirements.
- Notification & Delivery Router may choose only authorized recipients/resources and does not decide semantic intent.
- Internal Event Bus reports typed lifecycle facts; events cannot bypass protected execution paths.
- Schema & Contract Versioning must preserve or visibly reject compatibility and cannot broaden trust/scope/permissions.
- Feature Flags may restrict or disable availability but cannot grant permissions, ownership or authority.
- Protected actions require identity, permission, scope, resource authority where applicable, risk, cost and confirmation checks.
- Domain modules must not redefine the platform core.

## Core subsystems
1. Identity and Scope
2. Language & Locale Context
3. Session & Conversation Context
4. Semantic Kernel
5. Context and Memory
6. Decision Engine
7. Action Gate
8. Capability System
9. AI Routing
10. Transports
11. Configuration & Policy
12. Secrets & Credentials
13. External Connections Registry
14. Resource Ownership & Authority
15. User Settings & Preferences
16. Notification & Delivery Router
17. Internal Event Bus
18. Schema & Contract Versioning
19. Feature Flags & Controlled Rollout
20. Observability
21. Automation and Agents
22. Domain Modules
