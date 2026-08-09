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
9. `LANGUAGE_AND_LOCALE_CONTEXT.md`
10. `FOUNDATIONAL_CONTROL_LAYERS.md`
11. `SELF_KNOWLEDGE.md`
12. `MONARCH_OWNER_SECURITY.md`
13. `RUNTIME_COMPOSITION.md`
14. `POSTGRESQL_PERSISTENCE.md`

## Core flow

```text
Input
→ Identity and Scope Resolution
→ Language & Locale Context
→ Session & Conversation Context
→ Semantic Kernel
→ Context Resolution
→ Decision Envelope
→ Capability Selection
→ Resource/Connection Authority Context where required
→ Owner Security Policy where SG-wide privileged state is targeted
→ Action Classification
→ Action Gate
→ Execution or Answer
→ Delivery Routing where required
→ Response
→ Observability / Internal Events
```

Self Knowledge is a shared system-context layer used for evidence-aware descriptions of SG itself. It does not sit as a mandatory reasoning hop in every request and does not replace live diagnostics.

## Non-negotiable boundaries
- Connected AI models provide reasoning and may also execute specialized tasks.
- SG code does not imitate reasoning with keyword routing.
- Gates protect actions and do not become a second brain.
- Memory supplies bounded context and does not own SG identity.
- System Self Knowledge is separate from user/project memory and cannot grant authority.
- Commands are shortcuts; natural language is primary.
- Transports are thin adapters.
- Language and locale are shared SG context, not transport-owned business logic.
- Ordinary multilingual input reaches Semantic Kernel without mandatory pre-translation.
- Response-language policy belongs to SG, not to transports or AI providers.
- Configuration/policy is centralized and cannot silently become authorization.
- Raw secrets remain outside ordinary memory, Self Knowledge, prompts and telemetry.
- External connections are registered components, not identities or proof of resource ownership.
- Resource Ownership & Authority complements Identity, Scope and Access rather than replacing them.
- Verified owner/Monarch authority is rooted in `global_user_id`, not usernames, phrases, commands or AI interpretation.
- Only the verified owner may change SG-wide security/authority state; delegated permissions never imply SG ownership.
- AI, agents, tasks, workers, tools, events and domain modules cannot self-escalate or bypass owner/security authorization.
- User/model text cannot redefine canonical SG identity, ownership or architecture truth.
- Conversation context is separate from confirmed long-term memory.
- User preferences cannot weaken mandatory security or Action Gate requirements.
- Delivery cannot target unauthorized users or resources.
- Internal events report facts and cannot bypass protected execution paths.
- Contract version adapters cannot broaden scope, permissions or trust.
- Feature flags may restrict availability but cannot grant access or authority.
- Domain modules cannot redefine platform contracts.
- Runtime composition connects approved modules but cannot relocate their responsibilities.
- PostgreSQL persists approved contracts but cannot become the decision, identity-policy or authorization layer.
