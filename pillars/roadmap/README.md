# SG 2.1 ROADMAP

Roadmap defines what is built, dependency order, gates and acceptance boundaries. Blocks 0–10 are documented as individual roadmap files. The production continuation is documented canonically in `PRODUCTION_ROADMAP.md`, which contains Blocks 11–19, including intermediate Blocks 16.5–16.18, and Pilot Launch as one coordinated production program.

Memory 2.0 is a completed cross-cutting memory program documented separately in `MEMORY_2_0_ROADMAP.md`. It extends the existing Context/Memory foundation without changing the numbered production order.

Project Memory 3.0 is a planned specialized cross-cutting program documented in `PROJECT_MEMORY_3_0_PROGRAM.md`. It strengthens only the Memory 2.0 `Project Memory` domain and does not renumber Blocks 0–19.

Universal Diagnostics is a separate planned cross-cutting diagnostic program documented in `UNIVERSAL_DIAGNOSTICS_PROGRAM.md`. It is implemented as an independent observer application around SG, not as a new core layer and not as a renumbering of Blocks 0–19.

Block 8.1 is a production extension of completed Block 8 Interfaces. It adds the real Discord production transport on top of the existing Discord adapter contract and does not renumber Blocks 9–19.

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
11. `08_1_DISCORD_TRANSPORT_INTEGRATION.md` — Block 8.1 production extension of Interfaces
12. `09_AUTOMATION_AND_AGENTS.md`
13. `10_DOMAIN_MODULES.md`
14. `PRODUCTION_ROADMAP.md`
15. `11_RUNTIME_COMPOSITION.md` — implementation and acceptance evidence for Block 11
16. `12_POSTGRESQL_PERSISTENCE.md` — implementation and acceptance evidence for Block 12
17. `13_DURABLE_AUTOMATION_AND_WORKERS.md` — implementation and acceptance evidence for Block 13
18. `14_TELEGRAM_PRODUCTION_INTEGRATION.md` — implementation and acceptance evidence for Block 14
19. `15_PRODUCTION_AI_INTEGRATION.md` — implementation and acceptance evidence for Block 15
20. `16_PRODUCTION_CAPABILITIES.md` — implementation and acceptance evidence for Block 16
21. `16_5_TEMPORAL_CONTEXT.md` — implementation and acceptance evidence for Block 16.5
22. `16_6_LANGUAGE_AND_LOCALE_CONTEXT.md` — implementation and acceptance evidence for Block 16.6
23. `16_7_CONFIGURATION_AND_POLICY_LAYER.md` — implementation and acceptance evidence for Block 16.7
24. `16_8_SECRETS_AND_CREDENTIALS_MANAGEMENT.md` — implementation and acceptance evidence for Block 16.8
25. `16_9_EXTERNAL_CONNECTIONS_REGISTRY.md` — implementation and acceptance evidence for Block 16.9
26. `16_10_RESOURCE_OWNERSHIP_AND_AUTHORITY_MODEL.md` — implementation and acceptance evidence for Block 16.10
27. `16_11_SESSION_AND_CONVERSATION_CONTEXT.md` — implementation and acceptance evidence for Block 16.11
28. `16_12_USER_SETTINGS_AND_PREFERENCES.md` — implementation and acceptance evidence for Block 16.12
29. `16_13_NOTIFICATION_AND_DELIVERY_ROUTER.md` — implementation and acceptance evidence for Block 16.13
30. `16_14_INTERNAL_EVENT_BUS.md` — implementation and acceptance evidence for Block 16.14
31. `16_15_SCHEMA_AND_CONTRACT_VERSIONING.md` — implementation and acceptance evidence for Block 16.15
32. `16_16_FEATURE_FLAGS_AND_CONTROLLED_ROLLOUT.md` — implementation and acceptance evidence for Block 16.16
33. `16_17_SELF_KNOWLEDGE_SYSTEM_SELF_AWARENESS.md` — Block 16.17 specification/evidence
34. `16_18_MONARCH_CONTROL_OWNER_SECURITY.md` — Block 16.18 specification/evidence
35. `18_END_TO_END_VERIFICATION.md` — completed Block 18 implementation and acceptance evidence
36. `19_SECURITY_AND_OPERATIONS.md` — completed Block 19 implementation and acceptance evidence
37. `MEMORY_2_0_ROADMAP.md` — completed cross-cutting Memory 2.0 M1–M9 program
38. `PROJECT_MEMORY_3_0_PROGRAM.md` — planned specialized Project Memory 3.0 PM3.1–PM3.12 program
39. `UNIVERSAL_DIAGNOSTICS_PROGRAM.md` — planned cross-cutting Universal Diagnostics D1–D12 program

## Block 8.1 — Discord Transport Integration

**Status: Planned / contract foundation already present.**

The existing Block 8 code already contains a thin Discord adapter and contract tests. Block 8.1 owns the missing production path: Gateway/REST connection, durable deduplication, production Discord identity resolution, safe verified cross-platform Global ID linking, Discord delivery through the existing Delivery Router, scope/resource isolation, diagnostics, observability and live acceptance evidence.

Canonical specification: `08_1_DISCORD_TRANSPORT_INTEGRATION.md`.

## Block 18 — End-to-End Verification

**Status: Completed and CI-verified.**

The dedicated `tests/e2eVerification.test.js` suite verifies the composed SG runtime across identity/scope/language/conversation/memory boundaries, approved cross-transport continuation, owner-security anti-impersonation, original actor preservation, feature controls, Self Knowledge/runtime evidence and PostgreSQL restart continuity. The remaining roadmap scenarios reuse existing production integration suites for Telegram deduplication, retry/DLQ/idempotency, external failures, delivery routing, resource authority and worker recovery.

Detailed completion evidence: `18_END_TO_END_VERIFICATION.md`.

## Block 19 — Security and Operations

**Status: Completed and CI-verified.**

Block 19 adds the operational security layer around the completed SG product: bounded identity/transport/network rate limiting, hardened Telegram HTTP ingress, emergency controls, security posture checks, secret scanning/redaction, production dependency audit, explicit retention/recovery policies, backup→restore verification, actionable alert classes and a mandatory CI security gate before Pilot Launch.

Detailed completion evidence: `19_SECURITY_AND_OPERATIONS.md`.

## Memory 2.0

**Status: Completed and CI/runtime verified.**

Canonical implementation order:

`M1 Scope Model → M2 Shared Group Memory → M7 Permissions & Privacy → M3 Automatic Capture → M4 Consolidation → M5 Intelligent Recall → M6 Cross-Platform Global Memory → M8 Lifecycle → M9 Control/Diagnostics/Tests`.

Memory 2.0 preserves `global_user_id`, project/group/thread isolation, Conversation Context separation, System Self Knowledge separation, Action Gate, Resource Authority, provenance/trust, PostgreSQL durability and secret-safe observability.

Detailed completion evidence: `MEMORY_2_0_ROADMAP.md`.
Architecture: `../architecture/MEMORY_2_0.md`.
Workflow: `../workflow/MEMORY_2_0_WORKFLOW.md`.

## Project Memory 3.0

**Status: Planned and canonically specified.**

Canonical implementation order:

`PM3.1 Project Fact Contract & Namespaces → PM3.2 Durable PostgreSQL Store → PM3.3 Trusted Source Ingestion → PM3.4 Candidate/Confirmation/Monarch Control → PM3.5 Deduplication & Conflict Resolver → PM3.6 Temporal History & Supersession → PM3.7 Hybrid Retrieval & pgvector → PM3.8 Project Memory Context Guard → PM3.9 AI Router Integration → PM3.10 Decision & Incident Memory → PM3.11 Diagnostics & Observability → PM3.12 Production E2E & Live Acceptance`.

Project Memory 3.0 remains inside the Memory 2.0 Project Memory domain. It must not create a parallel memory/authority system, cannot auto-confirm raw chat/model output, and cannot claim Render as a live trusted source until a real Render Connector exists and is verified.

Detailed specification: `PROJECT_MEMORY_3_0_PROGRAM.md`.
Architecture: `../architecture/PROJECT_MEMORY_3_0.md`.
Workflow: `../workflow/PROJECT_MEMORY_3_0_WORKFLOW.md`.

## Universal Diagnostics

**Status: Planned and architecturally specified.**

Canonical implementation order:

`D1 Diagnostic Contract & Read-Only Boundary → D2 Collector & Evidence Storage → D3 Trace Reconstruction → D4 Expected Paths & Invariants → D5 First Divergence Engine → D6 Root Cause Analyzer → D7 Deployment/Runtime/Infrastructure Diagnostics → D8 Live Diagnostic Runner → D9 Replay & Regression Library → D10 Reports/API/UI/Security → D11 E2E Verification → D12 Independent Production Deployment`.

Universal Diagnostics is external to the mandatory SG request path. SG supplies bounded diagnostic facts; the separate application analyzes them. Diagnostics must be independently deployable, read-only by default, evidence-based, secret-safe, and unable to grant authority or block normal SG operation.

Detailed specification: `UNIVERSAL_DIAGNOSTICS_PROGRAM.md`.
Architecture: `../architecture/UNIVERSAL_DIAGNOSTICS.md`.
Workflow: `../workflow/UNIVERSAL_DIAGNOSTICS_WORKFLOW.md`.

## Production continuation

`PRODUCTION_ROADMAP.md` remains the canonical numbered continuation after Block 10. Memory 2.0, Project Memory 3.0 and Universal Diagnostics are separate cross-cutting programs and do not renumber Blocks 11–19. Block 8.1 remains an extension of Block 8 rather than a renumbering of that continuation.

Each production block/program stage must still be independently verifiable, reversible and completed through code, tests, documentation, CI and runtime evidence.

## Foundation rule
Before Semantic Kernel implementation begins, Block 0 establishes the repository, test and CI baseline plus minimal canonical `IdentityContext`, `ScopeContext` and `TraceContext` contracts.

These foundation contracts exist only to make every later request scoped and traceable from the first executable slice. Production identity linking, role/grant resolution, durable audit storage, telemetry backends and retention remain in Blocks 6 and 7.

## AI routing gate
Block 2.5 connects the production reasoning path through AI Router after Semantic Kernel and Context and Memory are stable, but before Decision Engine development begins. Until Block 2.5 is implemented, only fixture-based reasoning is allowed in tests and local development.
