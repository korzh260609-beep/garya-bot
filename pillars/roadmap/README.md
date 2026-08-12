# SG 2.1 ROADMAP

Roadmap defines what is built, dependency order, gates and acceptance boundaries. Blocks 0–10 are documented as individual roadmap files. The production continuation is documented canonically in `PRODUCTION_ROADMAP.md`, which contains Blocks 11–19, including intermediate Blocks 16.5–16.18, and Pilot Launch as one coordinated production program.

Memory 2.0 is a completed cross-cutting memory program documented separately in `MEMORY_2_0_ROADMAP.md`. It extends the existing Context/Memory foundation without changing the numbered production order.

Project Memory 3.0 is a completed specialized cross-cutting program documented in `PROJECT_MEMORY_3_0_PROGRAM.md`. It strengthens only the Memory 2.0 `Project Memory` domain and does not renumber Blocks 0–19.

Project Development Knowledge 4.0 has a completed CI-verified PDK4.1–PDK4.12 baseline plus a newly planned PDK4.13 Live Production Wiring & Autonomous Project History extension. PDK4.13 wires the existing engine into real production bootstrap/resume, continuous ingestion, protected diagnostics and live acceptance. It remains built on Project Memory 3.0 and does not create a parallel memory system or renumber Blocks 0–19.

Telegram Workspace Manager 1.0 is an in-progress cross-cutting Telegram management program documented in `TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md`; TWM1.1–TWM1.2 are CLOSED / CI-verified and TWM1.3 is next. It lets any authorized SG user configure and operate SG for their own Telegram groups, supergroups and channels through native Telegram UI and natural language while reusing Block 14 Telegram Production Integration, canonical Identity/Scope, Resource Authority, Action Gate, PostgreSQL, Memory 2.0 isolation, Durable Automation and AI Router. TWM1.14 adds text/media publication, polls, quizzes/tests, scheduled content, deterministic result statistics and bounded AI analysis. TWM1.15 extends the same backend with community operations, engagement and analytics: forms, events, FAQ/onboarding, feedback, cases, tasks/reminders/decisions, content planning, summaries, owner briefs and exports. TWM1 does not renumber Blocks 0–19 and does not create a second Telegram transport, memory, task, scheduler or authorization system.

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
21. `16_5_TEMPORAL_CONTEXT.md` — Block 16.5 implementation and acceptance evidence
22. `16_6_LANGUAGE_AND_LOCALE_CONTEXT.md` — Block 16.6 implementation and acceptance evidence
23. `16_7_CONFIGURATION_AND_POLICY_LAYER.md` — Block 16.7 implementation and acceptance evidence
24. `16_8_SECRETS_AND_CREDENTIALS_MANAGEMENT.md` — Block 16.8 implementation and acceptance evidence
25. `16_9_EXTERNAL_CONNECTIONS_REGISTRY.md` — Block 16.9 implementation and acceptance evidence
26. `16_10_RESOURCE_OWNERSHIP_AND_AUTHORITY_MODEL.md` — Block 16.10 implementation and acceptance evidence
27. `16_11_SESSION_AND_CONVERSATION_CONTEXT.md` — Block 16.11 implementation and acceptance evidence
28. `16_12_USER_SETTINGS_AND_PREFERENCES.md` — Block 16.12 implementation and acceptance evidence
29. `16_13_NOTIFICATION_AND_DELIVERY_ROUTER.md` — Block 16.13 implementation and acceptance evidence
30. `16_14_INTERNAL_EVENT_BUS.md` — Block 16.14 implementation and acceptance evidence
31. `16_15_SCHEMA_AND_CONTRACT_VERSIONING.md` — Block 16.15 implementation and acceptance evidence
32. `16_16_FEATURE_FLAGS_AND_CONTROLLED_ROLLOUT.md` — Block 16.16 implementation and acceptance evidence
33. `16_17_SELF_KNOWLEDGE_SYSTEM_SELF_AWARENESS.md` — Block 16.17 specification/evidence
34. `16_18_MONARCH_CONTROL_OWNER_SECURITY.md` — Block 16.18 specification/evidence
35. `18_END_TO_END_VERIFICATION.md` — completed Block 18 implementation and acceptance evidence
36. `19_SECURITY_AND_OPERATIONS.md` — completed Block 19 implementation and acceptance evidence
37. `MEMORY_2_0_ROADMAP.md` — completed cross-cutting Memory 2.0 M1–M9 program
38. `PROJECT_MEMORY_3_0_PROGRAM.md` — completed specialized Project Memory 3.0 PM3.1–PM3.12 program
39. `PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md` — completed PDK4.1–PDK4.12 baseline program
40. `PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md` — planned PDK4.13 live production wiring/autonomous history extension
41. `TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md` — in-progress TWM1 program; TWM1.1–TWM1.2 CLOSED / CI-verified, TWM1.3 next
42. `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_PROGRAM.md` — planned TWM1.15 community operations, engagement and analytics extension
43. `UNIVERSAL_DIAGNOSTICS_PROGRAM.md` — planned cross-cutting Universal Diagnostics D1–D12 program

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

**Status: Completed; PM3.1–PM3.12 CLOSED and CI/runtime verified.**

Canonical implementation order:

`PM3.1 Project Fact Contract & Namespaces → PM3.2 Durable PostgreSQL Store → PM3.3 Trusted Source Ingestion → PM3.4 Candidate/Confirmation/Monarch Control → PM3.5 Deduplication & Conflict Resolver → PM3.6 Temporal History & Supersession → PM3.7 Hybrid Retrieval & pgvector → PM3.8 Project Memory Context Guard → PM3.9 AI Router Integration → PM3.10 Decision & Incident Memory → PM3.11 Diagnostics & Observability → PM3.12 Production E2E & Live Acceptance`.

Project Memory 3.0 remains inside the Memory 2.0 Project Memory domain. It does not create a parallel memory/authority system, cannot auto-confirm raw chat/model output, and cannot claim Render as a live trusted source until a real Render Connector exists and is verified. PM3.12 closes the program with a fail-closed PostgreSQL/runtime E2E covering trusted GitHub evidence, confirmation, replay idempotency, conflict visibility, temporal supersession, restart continuity, guarded ordinary SG requests, provenance/currentness qualification, raw-chat rejection and Render-source denial. Code/runtime gate passed in SG 2.1 CI #7028 before final documentation synchronization.

Detailed completion evidence: `PROJECT_MEMORY_3_0_PROGRAM.md`.
Architecture: `../architecture/PROJECT_MEMORY_3_0.md`.
Workflow: `../workflow/PROJECT_MEMORY_3_0_WORKFLOW.md`.

## Project Development Knowledge 4.0

**Status: PDK4.1–PDK4.12 CLOSED / CI-verified; PDK4.13 PLANNED.**

Canonical implementation order:

`PDK4.1 Development Knowledge Contract & Taxonomy → PDK4.2 GitHub Historical Scanner & Durable Cursor → PDK4.3 Source Normalization & Verification → PDK4.4 Development Significance Classifier → PDK4.5 Development Event Extraction → PDK4.6 Commit/Event Clustering & Milestones → PDK4.7 Historical Reconstruction & Project Genesis → PDK4.8 Temporal/Causal Linking & Reconciliation → PDK4.9 Continuous GitHub Ingestion → PDK4.10 Product Component Registry & Current Project Snapshot → PDK4.11 Development Query & Normal SG Answer Integration → PDK4.12 Diagnostics, Production Bootstrap & Live Acceptance → PDK4.13 Live Production Wiring & Autonomous Project History`.

PDK4 builds on the completed Project Memory 3.0 foundation. PDK4.1–PDK4.12 provide the complete CI-verified development-history engine, PostgreSQL persistence/restart semantics, GitHub production source contract, diagnostics and production-like acceptance. PDK4.13 is the next production extension: it must wire that engine into real SG startup/worker composition, automatically bootstrap/resume real repository history, continuously reconcile new commits, use a PostgreSQL single-flight guard, expose protected live diagnostics and prove real production restart/new-commit/replay/query acceptance.

PDK4.13 does not redefine evidence semantics. Canonical documents cannot by themselves prove implementation, CI cannot imply deployment/live state, supporting evidence cannot silently promote milestone state, and deployment/runtime evidence still requires an approved source. PDK4 continues to reuse PM3 PostgreSQL storage for durable project facts, provenance, trust, confirmation, dedup/conflict, temporal history, retrieval and Context Guard.

PDK4.1–PDK4.12 final baseline was synchronized at commit `9b9f14afad4a2398e37f7b3e57548dfd4e5253f8` with SG 2.1 CI #7169 SUCCESS. PDK4.13 remains planned until code, CI, deployment and live acceptance are completed.

Baseline program: `PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md`.
PDK4.13 roadmap: `PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md`.
Architecture baseline: `../architecture/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0.md`.
PDK4.13 architecture: `../architecture/PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md`.
Baseline workflow: `../workflow/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_WORKFLOW.md`.
PDK4.13 workflow: `../workflow/PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING_WORKFLOW.md`.

## Telegram Workspace Manager 1.0

**Status: IN PROGRESS — TWM1.1–TWM1.2 CLOSED / CI-VERIFIED; TWM1.3 NEXT.**

Canonical implementation order:

`TWM1.1 Workspace Contract & Lifecycle → TWM1.2 PostgreSQL Workspace Persistence → TWM1.3 Telegram Workspace Discovery & Registry → TWM1.4 Workspace Authority Verification → TWM1.5 Bot Permission Discovery & Capability Health → TWM1.6 Workspace Configuration Service → TWM1.7 Decision/Action Gate Integration → TWM1.8 Telegram Native UI & Setup Wizard → TWM1.9 Natural-Language Configuration → TWM1.10 Workspace Runtime Wiring → TWM1.11 Audit/Rollback/Diagnostics/Observability → TWM1.12 Production E2E & Live Acceptance → TWM1.13 Telegram Mini App → TWM1.14 Content, Polls, Quizzes & Media Management → TWM1.15 Community Operations, Engagement & Analytics`.

TWM1.1 establishes the canonical workspace contract/scope. TWM1.2 adds durable PostgreSQL workspaces, members/roles, bot-permission snapshots, versioned configuration and configuration history with restart/isolation/transaction gates. TWM1.3 is the next stage and owns Telegram workspace discovery/registry; TWM1.2 does not claim live discovery or authority verification.

TWM1 is the SG-native alternative to a separate third-party bot constructor. Any authorized SG user can manage SG in their own Telegram groups/channels without programming. One user may manage many workspaces and one workspace may have several bounded managers, but every mutation remains tied to canonical `global_user_id`, verified workspace scope and revocable Resource Authority.

The Telegram transport remains thin. Telegram creator/administrator metadata is only workspace-specific authority evidence and cannot create SG-global ownership. AI may translate natural-language requests into structured proposals only through AI Router; protected writes/external actions remain owned by SG services and protected by validation, authorization and Action Gate.

TWM1.14 adds a content-management plane over the same backend: authorized users may create/publish/schedule text content, Telegram polls, quiz-mode polls and SG-managed test sessions, and publish photos/videos/documents supplied to SG. Structured Telegram/SG result events are normalized/deduplicated and exact totals, percentages and scores are computed deterministically. AI Router may analyze or explain the resulting immutable snapshot but cannot invent or override numeric results. Anonymous Telegram polls remain aggregate-only. Scheduled publication reuses the existing durable automation/scheduler and revalidates authority/capability as required at execution time.

TWM1.15 adds five bounded functional packages: Content, Engagement, Community, Operations and Analytics. It covers forms/questionnaires, feedback, events/registration/waitlists, competitions/challenges, FAQ/onboarding, unanswered-question/moderation workflows, request/case queues, tasks/reminders/decisions, content planning/recurring rubrics, discussion summaries, deterministic analytics, owner briefs and authorized exports. It reuses Memory 2.0, Conversation Context, existing tasks/capabilities, Durable Automation, Delivery Router, AI Router and Observability. Operational records do not become confirmed shared memory automatically, private data cannot leak through FAQ/analytics/exports, AI cannot fabricate exact metrics or mutate state, and poll/test results require a separate authorized decision transition before becoming binding decisions.

Core TWM1 is complete only after real Telegram group+channel live acceptance proves configuration persistence, runtime effect, restart continuity, unauthorized denial, authority revocation and cross-workspace isolation. TWM1.13 is optional rich UI. TWM1.14 and TWM1.15 are separately closable functional extensions with their own code/CI/live acceptance gates.

Program: `TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md`.
TWM1.15 program: `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_PROGRAM.md`.
Architecture: `../architecture/TELEGRAM_WORKSPACE_MANAGER_1_0.md`.
TWM1.15 architecture: `../architecture/TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS.md`.
Workflow: `../workflow/TELEGRAM_WORKSPACE_MANAGER_1_0_WORKFLOW.md`.
TWM1.15 workflow: `../workflow/TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_WORKFLOW.md`.

## Universal Diagnostics

**Status: Planned and architecturally specified.**

Canonical implementation order:

`D1 Diagnostic Contract & Read-Only Boundary → D2 Collector & Evidence Storage → D3 Trace Reconstruction → D4 Expected Paths & Invariants → D5 First Divergence Engine → D6 Root Cause Analyzer → D7 Deployment/Runtime/Infrastructure Diagnostics → D8 Live Diagnostic Runner → D9 Replay & Regression Library → D10 Reports/API/UI/Security → D11 E2E Verification → D12 Independent Production Deployment`.

Universal Diagnostics is external to the mandatory SG request path. SG supplies bounded diagnostic facts; the separate application analyzes them. Diagnostics must be independently deployable, read-only by default, evidence-based, secret-safe, and unable to grant authority or block normal SG operation.

Detailed specification: `UNIVERSAL_DIAGNOSTICS_PROGRAM.md`.
Architecture: `../architecture/UNIVERSAL_DIAGNOSTICS.md`.
Workflow: `../workflow/UNIVERSAL_DIAGNOSTICS_WORKFLOW.md`.

## Production continuation

`PRODUCTION_ROADMAP.md` remains the canonical numbered continuation after Block 10. Memory 2.0, Project Memory 3.0, Project Development Knowledge 4.0, Telegram Workspace Manager 1.0 and Universal Diagnostics are separate cross-cutting programs and do not renumber Blocks 11–19. Block 8.1 remains an extension of Block 8 rather than a renumbering of that continuation.

Each production block/program stage must still be independently verifiable, reversible and completed through code, tests, documentation, CI and runtime evidence.

## Foundation rule
Before Semantic Kernel implementation begins, Block 0 establishes the repository, test and CI baseline plus minimal canonical `IdentityContext`, `ScopeContext` and `TraceContext` contracts.

These foundation contracts exist only to make every later request scoped and traceable from the first executable slice. Production identity linking, role/grant resolution, durable audit storage, telemetry backends and retention remain in Blocks 6 and 7.

## AI routing gate
Block 2.5 connects the production reasoning path through AI Router after Semantic Kernel and Context and Memory are stable, but before Decision Engine development begins. Until Block 2.5 is implemented, only fixture-based reasoning is allowed in tests and local development.