# PILLARS — SG 2.1 CANONICAL INDEX

`pillars/` contains only active documentation required to build and operationalize SG 2.1.

## Authority

```text
DECISIONS
→ ARCHITECTURE
→ ROADMAP
→ WORKFLOW
→ CODE
→ TEST / RUNTIME EVIDENCE
```

## Root files
- `DECISIONS.md` — accepted global decisions
- `SG_ENTITY.md` — system identity and boundaries
- `SG_BEHAVIOR.md` — behavior and action-control rules
- `PROJECT.md` — project purpose and success criteria
- `README.md` — this index

## Architecture
Entry: `architecture/README.md`

Active files:
- `SG21_SYSTEM.md`
- `SEMANTIC_KERNEL.md`
- `CONTEXT_AND_MEMORY.md`
- `DECISION_AND_ACTION_GATE.md`
- `CAPABILITY_SYSTEM.md`
- `IDENTITY_AND_SCOPE.md`
- `OBSERVABILITY.md`
- `TRANSPORTS_AND_AI_ROUTING.md`
- `LANGUAGE_AND_LOCALE_CONTEXT.md`
- `FOUNDATIONAL_CONTROL_LAYERS.md`
- `SELF_KNOWLEDGE.md`
- `MONARCH_OWNER_SECURITY.md`
- `RUNTIME_COMPOSITION.md`
- `POSTGRESQL_PERSISTENCE.md`

## Roadmap
Entry: `roadmap/README.md`

Active files:
- `00_ENGINEERING_FOUNDATION.md`
- `00_PRINCIPLES_AND_GATES.md`
- `01_SEMANTIC_KERNEL.md`
- `02_CONTEXT_AND_MEMORY.md`
- `02_5_AI_ROUTING_FOUNDATION.md`
- `03_DECISION_ENGINE.md`
- `04_ACTION_GATE.md`
- `05_CAPABILITY_SYSTEM.md`
- `06_IDENTITY_AND_SCOPE.md`
- `07_OBSERVABILITY.md`
- `08_INTERFACES.md`
- `09_AUTOMATION_AND_AGENTS.md`
- `10_DOMAIN_MODULES.md`
- `11_RUNTIME_COMPOSITION.md` — Block 11 implementation and acceptance evidence
- `12_POSTGRESQL_PERSISTENCE.md` — Block 12 implementation and acceptance evidence
- `13_DURABLE_AUTOMATION_AND_WORKERS.md` — Block 13 implementation and acceptance evidence
- `14_TELEGRAM_PRODUCTION_INTEGRATION.md` — Block 14 implementation and acceptance evidence
- `15_PRODUCTION_AI_INTEGRATION.md` — Block 15 implementation and acceptance evidence
- `16_PRODUCTION_CAPABILITIES.md` — Block 16 implementation and acceptance evidence
- `16_5_TEMPORAL_CONTEXT.md` — Block 16.5 implementation and acceptance evidence
- `16_6_LANGUAGE_AND_LOCALE_CONTEXT.md` — Block 16.6 implementation and acceptance evidence
- `16_7_CONFIGURATION_AND_POLICY_LAYER.md` — Block 16.7 implementation and acceptance evidence
- `16_8_SECRETS_AND_CREDENTIALS_MANAGEMENT.md` — Block 16.8 implementation and acceptance evidence
- `16_9_EXTERNAL_CONNECTIONS_REGISTRY.md` — Block 16.9 implementation and acceptance evidence
- `16_10_RESOURCE_OWNERSHIP_AND_AUTHORITY_MODEL.md` — Block 16.10 implementation and acceptance evidence
- `16_11_SESSION_AND_CONVERSATION_CONTEXT.md` — Block 16.11 implementation and acceptance evidence
- `16_12_USER_SETTINGS_AND_PREFERENCES.md` — Block 16.12 implementation and acceptance evidence
- `16_13_NOTIFICATION_AND_DELIVERY_ROUTER.md` — Block 16.13 implementation and acceptance evidence
- `16_14_INTERNAL_EVENT_BUS.md` — Block 16.14 implementation and acceptance evidence
- `16_15_SCHEMA_AND_CONTRACT_VERSIONING.md` — Block 16.15 implementation and acceptance evidence
- `16_16_FEATURE_FLAGS_AND_CONTROLLED_ROLLOUT.md` — Block 16.16 implementation and acceptance evidence
- `16_17_SELF_KNOWLEDGE_SYSTEM_SELF_AWARENESS.md` — Block 16.17 planned specification/future acceptance evidence
- `16_18_MONARCH_CONTROL_OWNER_SECURITY.md` — Block 16.18 planned specification/future acceptance evidence
- `PRODUCTION_ROADMAP.md` — canonical continuation covering Blocks 11–19, intermediate Blocks 16.5–16.18 and Pilot Launch

## Workflow
Entry: `workflow/README.md`

Active files:
- `DEVELOPMENT_PROTOCOL.md`
- `CHANGE_SPECIFICATION.md`
- `TEST_AND_EVIDENCE_PROTOCOL.md`
- `RELEASE_AND_ROLLBACK_PROTOCOL.md`
- `ARCHITECTURE_DECISION_PROTOCOL.md`

Workflow defines implementation procedure and does not store per-block runtime history. Therefore `workflow/changes/` and `workflow/changes/BLOCK_11_RUNTIME_COMPOSITION.md` are not canonical paths.

## Modules
`modules/` starts empty except for its README. Module documentation is created only when the corresponding SG 2.1 module is introduced through the active roadmap.

## Hard rule
Any file not listed by this index is not active SG 2.1 truth and must not be added under `pillars/` without explicit architectural purpose.
