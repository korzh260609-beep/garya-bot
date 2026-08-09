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
4. `MEMORY_2_0.md`
5. `DECISION_AND_ACTION_GATE.md`
6. `CAPABILITY_SYSTEM.md`
7. `IDENTITY_AND_SCOPE.md`
8. `OBSERVABILITY.md`
9. `TRANSPORTS_AND_AI_ROUTING.md`
10. `LANGUAGE_AND_LOCALE_CONTEXT.md`
11. `FOUNDATIONAL_CONTROL_LAYERS.md`
12. `SELF_KNOWLEDGE.md`
13. `MONARCH_OWNER_SECURITY.md`
14. `RUNTIME_COMPOSITION.md`
15. `POSTGRESQL_PERSISTENCE.md`
16. `UNIVERSAL_DIAGNOSTICS.md`

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

Memory 2.0 is the canonical durable memory subsystem layered behind Context Resolution and response-context assembly. It preserves user/group/thread/project isolation, privacy-first recall, lifecycle, provenance and verified `global_user_id` continuity without replacing Conversation Context or System Self Knowledge.

Self Knowledge is a shared system-context layer used for evidence-aware descriptions of SG itself. It does not sit as a mandatory reasoning hop in every request and does not replace live diagnostics.

Universal Diagnostics is an independent observer application outside the mandatory SG request path. SG emits bounded diagnostic facts through Observability and approved read-only surfaces; the separate Diagnostics application reconstructs traces, compares expected vs actual paths, finds first divergence, performs deterministic root-cause analysis, runs isolated synthetic checks, and produces evidence-backed reports. SG must continue operating if Diagnostics is unavailable.

## Non-negotiable boundaries
- Connected AI models provide reasoning and may also execute specialized tasks.
- SG code does not imitate reasoning with keyword routing.
- Gates protect actions and do not become a second brain.
- Memory supplies bounded context and does not own SG identity.
- Memory 2.0 cannot broaden scope, privacy, authority or trust during capture/recall/consolidation.
- System Self Knowledge is separate from user/project memory and cannot grant authority.
- Universal Diagnostics is not SG brain, Decision Engine, Action Gate, authorization or ordinary request routing.
- Diagnostics is read-only by default; it must not silently edit code/config, deploy, mutate production state, grant authority or repair SG automatically.
- Diagnostics failure must not block, restart or degrade normal SG request execution by architectural dependency.
- Diagnostic synthetic runs must be isolated from ordinary confirmed memory, user settings, profile/psychological adaptation and ordinary persistent tasks.
- Diagnostic conclusions require evidence; unavailable evidence lowers confidence instead of being invented.
- AI may explain deterministic diagnostic findings but cannot independently declare a root cause confirmed.
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
