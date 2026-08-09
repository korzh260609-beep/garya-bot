# SG 2.1 ROADMAP

Roadmap defines what is built, dependency order, gates and acceptance boundaries. Blocks 0–10 are documented as individual roadmap files. The production continuation is documented canonically in `PRODUCTION_ROADMAP.md`, which contains Blocks 11–19, including intermediate Blocks 16.5–16.18, and Pilot Launch as one coordinated production program.

Memory 2.0 is a completed cross-cutting memory program documented separately in `MEMORY_2_0_ROADMAP.md`. It extends the existing Context/Memory foundation without changing the numbered production order.

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
32. `16_17_SELF_KNOWLEDGE_SYSTEM_SELF_AWARENESS.md` — Block 16.17 specification/evidence
33. `16_18_MONARCH_CONTROL_OWNER_SECURITY.md` — Block 16.18 specification/evidence
34. `MEMORY_2_0_ROADMAP.md` — completed cross-cutting Memory 2.0 M1–M9 program

## Memory 2.0

**Status: Completed and CI/runtime verified.**

Canonical implementation order:

`M1 Scope Model → M2 Shared Group Memory → M7 Permissions & Privacy → M3 Automatic Capture → M4 Consolidation → M5 Intelligent Recall → M6 Cross-Platform Global Memory → M8 Lifecycle → M9 Control/Diagnostics/Tests`.

Memory 2.0 preserves `global_user_id`, project/group/thread isolation, Conversation Context separation, System Self Knowledge separation, Action Gate, Resource Authority, provenance/trust, PostgreSQL durability and secret-safe observability.

Detailed completion evidence: `MEMORY_2_0_ROADMAP.md`.
Architecture: `../architecture/MEMORY_2_0.md`.
Workflow: `../workflow/MEMORY_2_0_WORKFLOW.md`.

## Production continuation

`PRODUCTION_ROADMAP.md` remains the canonical numbered continuation after Block 10. Memory 2.0 is a separate completed cross-cutting program and does not renumber Blocks 11–19.

Each production block must still be independently verifiable, reversible and completed through code, tests, documentation, CI and runtime evidence.

## Foundation rule
Before Semantic Kernel implementation begins, Block 0 establishes the repository, test and CI baseline plus minimal canonical `IdentityContext`, `ScopeContext` and `TraceContext` contracts.

These foundation contracts exist only to make every later request scoped and traceable from the first executable slice. Production identity linking, role/grant resolution, durable audit storage, telemetry backends and retention remain in Blocks 6 and 7.

## AI routing gate
Block 2.5 connects the production reasoning path through AI Router after Semantic Kernel and Context and Memory are stable, but before Decision Engine development begins. Until Block 2.5 is implemented, only fixture-based reasoning is allowed in tests and local development.
