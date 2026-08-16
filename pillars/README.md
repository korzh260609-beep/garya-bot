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
- `MEMORY_2_0.md`
- `PROJECT_MEMORY_3_0.md` — specialized evidence-backed Project Memory architecture inside Memory 2.0
- `PROJECT_DEVELOPMENT_KNOWLEDGE_4_0.md` — development-history/project-evolution architecture built on Project Memory 3.0
- `PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md` — planned live production wiring for PDK4.13
- `TELEGRAM_WORKSPACE_MANAGER_1_0.md` — active TWM1 architecture; TWM1.1–TWM1.9 CLOSED / CI-verified and TWM1.10 next, including later content/polls/quizzes/media/statistics and bounded AI analysis
- `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS.md` — planned TWM1.15 community operations, engagement and analytics architecture
- `SG_ACCESS_CONTROL_SYSTEM_1_0.md` — transport-neutral access/entitlement architecture
- `AUTOMATION_2_0_EXECUTABLE_WORKFLOWS.md` — accepted architecture for editable, versioned, execution-time workflows over the existing durable automation substrate
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
- `UNIVERSAL_DIAGNOSTICS.md` — architecture for the independent SG Diagnostics application and SG-side observation boundary

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
- `08_1_DISCORD_TRANSPORT_INTEGRATION.md` — Block 8.1 production Discord extension of Interfaces
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
- `16_17_SELF_KNOWLEDGE_SYSTEM_SELF_AWARENESS.md` — completed Block 16.17 implementation and acceptance evidence
- `16_18_MONARCH_CONTROL_OWNER_SECURITY.md` — planned Block 16.18 specification
- `MEMORY_2_0_ROADMAP.md` — completed canonical Memory 2.0 M1–M9 program and acceptance evidence
- `PROJECT_MEMORY_3_0_PROGRAM.md` — completed specialized Project Memory PM3.1–PM3.12 program
- `PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md` — completed PDK4.1–PDK4.12 development-history/project-evolution baseline
- `PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md` — planned PDK4.13 live production wiring extension
- `TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md` — active TWM1 program; TWM1.1–TWM1.9 CLOSED / CI-verified and TWM1.10 next, with later TWM1.14 Content, Polls, Quizzes & Media Management
- `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_PROGRAM.md` — planned TWM1.15 forms/events/FAQ/onboarding/feedback/cases/tasks/decisions/content planning/summaries/analytics/briefs/exports program
- `SG_ACCESS_CONTROL_SYSTEM_1_0_PROGRAM.md` — planned transport-neutral access/entitlement program
- `AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_PROGRAM.md` — planned AW2.1–AW2.20 executable-workflow extension; not runtime-implemented by documentation alone
- `UNIVERSAL_DIAGNOSTICS_PROGRAM.md` — canonical Universal Diagnostics D1–D12 cross-cutting program
- `PRODUCTION_ROADMAP.md` — canonical continuation covering Blocks 11–19, intermediate Blocks 16.5–16.18 and Pilot Launch
- `CURRENT_STATUS.md` — canonical current-state index when historical roadmap labels are stale

## Workflow
Entry: `workflow/README.md`

Active files:
- `DEVELOPMENT_PROTOCOL.md`
- `CHANGE_SPECIFICATION.md`
- `TEST_AND_EVIDENCE_PROTOCOL.md`
- `RELEASE_AND_ROLLBACK_PROTOCOL.md`
- `ARCHITECTURE_DECISION_PROTOCOL.md`
- `MEMORY_2_0_WORKFLOW.md` — Memory 2.0 implementation/verification sequence
- `PROJECT_MEMORY_3_0_WORKFLOW.md` — Project Memory 3.0 implementation/verification sequence
- `PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_WORKFLOW.md` — PDK4 baseline implementation/verification sequence
- `PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING_WORKFLOW.md` — PDK4.13 production wiring workflow
- `TELEGRAM_WORKSPACE_MANAGER_1_0_WORKFLOW.md` — active TWM1 implementation/verification sequence; TWM1.1–TWM1.9 CLOSED / CI-verified and TWM1.10 next
- `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_WORKFLOW.md` — TWM1.15 community operations/engagement/analytics implementation and live-acceptance sequence
- `SG_ACCESS_CONTROL_SYSTEM_1_0_WORKFLOW.md` — ACS1 implementation/verification sequence
- `AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_WORKFLOW.md` — AW2 implementation, migration, security, freshness, idempotency and live-acceptance sequence
- `UNIVERSAL_DIAGNOSTICS_WORKFLOW.md` — Universal Diagnostics D1–D12 implementation/verification sequence

Workflow defines implementation procedure and does not store per-block runtime history. Therefore `workflow/changes/` and `workflow/changes/BLOCK_11_RUNTIME_COMPOSITION.md` are not canonical paths.

## Cross-cutting programs and extensions

Memory 2.0, Project Memory 3.0, Project Development Knowledge 4.0, Telegram Workspace Manager 1.0, SG Access Control System 1.0, Automation 2.0 and Universal Diagnostics are cross-cutting programs/extensions and do not renumber the canonical Blocks 0–19.

Project Memory 3.0 is not a replacement for Memory 2.0. It specializes the `Project Memory` domain using trusted-source ingestion, candidate/confirmation policy, deduplication, conflict handling, temporal supersession, relations, hybrid retrieval and guarded project-context injection. It remains separate from System Self Knowledge and live diagnostics. Render must not be treated as a live Project Memory source until a real Render Connector is implemented and verified.

Project Development Knowledge 4.0 is not a new memory store. It builds on Project Memory 3.0 to reconstruct and continuously maintain SG development knowledge across origin, requirements, proposals, decisions/rationale, implementation/rework, incidents/fixes, CI/deployment/runtime evidence, historical supersession, current state and next plan. It must keep `implemented`, `ci-verified`, `deployed` and `live-verified` distinct, preserve provenance and history, and route all model assistance through AI Router. Current lifecycle truth comes from `roadmap/CURRENT_STATUS.md` where older roadmap labels conflict.

Telegram Workspace Manager 1.0 is not a second Telegram transport or a second identity/authorization stack. It lets authorized SG users configure and operate SG for their own Telegram groups, supergroups and channels while reusing canonical `global_user_id`, Identity/Scope, Resource Authority, Action Gate, PostgreSQL, Memory 2.0 isolation, AI Router and existing Telegram production integration. TWM1.14 extends that same scoped backend with content creation/publication, polls, quizzes/tests, user-supplied media, deterministic result collection/statistics and optional AI Router interpretation. TWM1.15 extends it with bounded engagement/community/operations/analytics functions. Current lifecycle truth comes from `roadmap/CURRENT_STATUS.md`.

TWM1.15 MUST reuse existing Memory 2.0, Session/Conversation Context, task/capability, Durable Automation, Delivery Router, AI Router and Observability foundations. Operational data does not become shared confirmed memory automatically; private user data cannot leak into FAQ/analytics/exports; AI cannot mutate state or fabricate exact metrics; and poll/test outcomes require a separate authorized decision transition before they can become binding workspace decisions.

Automation 2.0 is not a second automation engine. It upgrades the semantic contract and execution model above the existing task/schedule/Durable Worker substrate so an automation can be versioned, semantically patched, collect fresh authorized evidence and perform bounded multi-step work at execution time. It reuses Temporal Context, Capability System, Identity/Scope, Access, Resource Authority, Action Gate, Credential Manager, PostgreSQL, Delivery Router, AI Router and Observability. Its accepted architecture and program are **PLANNED / NOT IMPLEMENTED** until code/CI/deployment/live evidence proves otherwise.

Block 8.1 is not a new independent core layer. It is the production Discord transport extension of Block 8 Interfaces and does not renumber Blocks 9–19. Its implementation must reuse the existing Identity/Scope, canonical `global_user_id`, Memory 2.0, Resource Authority, Delivery Router, Observability and security boundaries.

Universal Diagnostics is explicitly an independent observer application. SG provides bounded observable facts; the external Diagnostics program reconstructs execution, verifies expected paths/invariants, finds first divergence/root cause and reports evidence. Diagnostics must not become a required SG runtime dependency or a bypass around identity, permissions, Action Gate, resource authority or owner security.

## Modules
`modules/` starts empty except for its README. Module documentation is created only when the corresponding SG 2.1 module is introduced through the active roadmap. Cross-cutting architecture/program/workflow detail remains canonical in its pillar sources unless a separate module document adds non-duplicative architectural value.

## Hard rule
Any file not listed by this index is not active SG 2.1 truth and must not be added under `pillars/` without explicit architectural purpose.
