# SG 2.1 ROADMAP

Roadmap defines what is built, dependency order, gates and acceptance boundaries. Blocks 0–10 are documented as individual roadmap files. The production continuation is documented canonically in `PRODUCTION_ROADMAP.md`, which contains Blocks 11–19, including intermediate Blocks 16.5–16.16, and Pilot Launch as one coordinated production program.

## Order
0. `00_ENGINEERING_FOUNDATION.md`
1. `00_PRINCIPLES_AND_GATES.md`
2. `01_SEMANTIC_KERNEL.md`
3. `02_CONTEXT_AND_MEMORY.md`
4. `02_5_AI_ROUTING_FOUNDATION.md`
5. `03_DECISION_ENGINE.md`
6. `04_ACTION_GATE.md`
7. `05_CAPABILITY_SYSTEM.md`
8. `06_IDENTITY_AND_SCOPE.md`
9. `07_OBSERVABILITY.md`
10. `08_INTERFACES.md`
11. `09_AUTOMATION_AND_AGENTS.md`
12. `10_DOMAIN_MODULES.md`
13. `PRODUCTION_ROADMAP.md`
14. `11_RUNTIME_COMPOSITION.md` — implementation and acceptance evidence for Block 11
15. `12_POSTGRESQL_PERSISTENCE.md` — implementation and acceptance evidence for Block 12
16. `13_DURABLE_AUTOMATION_AND_WORKERS.md` — implementation and acceptance evidence for Block 13
17. `14_TELEGRAM_PRODUCTION_INTEGRATION.md` — implementation and acceptance evidence for Block 14
18. `15_PRODUCTION_AI_INTEGRATION.md` — implementation and acceptance evidence for Block 15
19. `16_PRODUCTION_CAPABILITIES.md` — implementation and acceptance evidence for Block 16
20. `16_5_TEMPORAL_CONTEXT.md` — implementation and acceptance evidence for Block 16.5
21. `16_6_LANGUAGE_AND_LOCALE_CONTEXT.md` — implementation and acceptance evidence for Block 16.6
22. `16_7_CONFIGURATION_AND_POLICY_LAYER.md` — implementation and acceptance evidence for Block 16.7
23. `16_8_SECRETS_AND_CREDENTIALS_MANAGEMENT.md` — implementation and acceptance evidence for Block 16.8
24. `16_9_EXTERNAL_CONNECTIONS_REGISTRY.md` — implementation and acceptance evidence for Block 16.9
25. `16_10_RESOURCE_OWNERSHIP_AND_AUTHORITY_MODEL.md` — implementation and acceptance evidence for Block 16.10
26. `16_11_SESSION_AND_CONVERSATION_CONTEXT.md` — implementation and acceptance evidence for Block 16.11
27. `16_12_USER_SETTINGS_AND_PREFERENCES.md` — implementation and acceptance evidence for Block 16.12
28. `16_13_NOTIFICATION_AND_DELIVERY_ROUTER.md` — implementation and acceptance evidence for Block 16.13
29. `16_14_INTERNAL_EVENT_BUS.md` — implementation and acceptance evidence for Block 16.14
30. `16_15_SCHEMA_AND_CONTRACT_VERSIONING.md` — implementation and acceptance evidence for Block 16.15
31. `16_16_FEATURE_FLAGS_AND_CONTROLLED_ROLLOUT.md` — implementation and acceptance evidence for Block 16.16

## Production continuation

`PRODUCTION_ROADMAP.md` is the canonical continuation after Block 10 and fixes the implementation order as:

1. Block 11 — Runtime Composition — completed
2. Block 12 — PostgreSQL Persistence — completed
3. Block 13 — Durable Automation and Workers — completed
4. Block 14 — Telegram Production Integration — completed
5. Block 15 — Production AI Integration — completed
6. Block 16 — Production Capabilities — completed
7. Block 16.5 — Temporal Context — completed
8. Block 16.6 — Language & Locale Context — completed
9. Block 16.7 — Configuration & Policy Layer — completed
10. Block 16.8 — Secrets & Credentials Management — completed
11. Block 16.9 — External Connections Registry — completed
12. Block 16.10 — Resource Ownership & Authority Model — completed
13. Block 16.11 — Session & Conversation Context — completed
14. Block 16.12 — User Settings & Preferences — completed
15. Block 16.13 — Notification & Delivery Router — completed
16. Block 16.14 — Internal Event Bus — completed and production-wired
17. Block 16.15 — Schema & Contract Versioning — completed and production-wired
18. Block 16.16 — Feature Flags & Controlled Rollout — completed
19. Block 17 — Render Deployment — next
20. Block 18 — End-to-End Verification
21. Block 19 — Security and Operations
22. Pilot Launch

Repository-wide audit hardening after Block 16.16 additionally verifies canonical observability compatibility, version enforcement at production capability boundaries, production Event Bus/Domain Runtime composition, canonical feature-disabled results and rollback-safe Render startup. This hardening is corrective work within completed blocks and does not create a new roadmap block.

Each production block must still be independently verifiable, reversible and completed through code, tests, documentation, CI and runtime evidence.

## Foundation rule
Before Semantic Kernel implementation begins, Block 0 establishes the repository, test and CI baseline plus minimal canonical `IdentityContext`, `ScopeContext` and `TraceContext` contracts.

These foundation contracts exist only to make every later request scoped and traceable from the first executable slice. Production identity linking, role/grant resolution, durable audit storage, telemetry backends and retention remain in Blocks 6 and 7.

## AI routing gate
Block 2.5 connects the production reasoning path through AI Router after Semantic Kernel and Context and Memory are stable, but before Decision Engine development begins. Until Block 2.5 is implemented, only fixture-based reasoning is allowed in tests and local development.
