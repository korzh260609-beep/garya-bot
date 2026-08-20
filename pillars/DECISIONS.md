# DECISIONS.md — SG 2.1 CANONICAL DECISIONS

Status: CANONICAL
Owner: Monarch Gary

This file contains only accepted global decisions for SG 2.1.

## Authority

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

## D-001 — SG is one transport-independent project system
SG is not Telegram, Discord, one bot, one model, one agent, one router, one repository or one interface. These are replaceable components, channels or tools.

## D-002 — The connected AI model provides reasoning
The selected reasoning model interprets meaning, analyzes and plans. SG code must not attempt to replace trained reasoning with keyword, phrase, regex or template logic.

## D-003 — SG code organizes controlled work
SG code owns context access, memory boundaries, source/tool access, capability contracts, permissions, risk, cost, confirmation, idempotency, audit and execution control.

## D-004 — Natural language is the primary interface
Commands are diagnostic or administrative shortcuts. A capability must exist independently from any command that invokes it.

## D-005 — Semantic Kernel precedes transports and storage
The first core is platform-independent. Telegram, Discord, Web/API, email and voice are added later as thin adapters.

## D-006 — Controllers protect actions; they do not become SG brain
The reasoning layer understands meaning. Action Gate validates identity, permission, scope, source/tool availability, risk, cost, confirmation, idempotency and audit requirements.

## D-007 — SG is free in analysis and controlled in actions
Analysis, explanation, criticism, planning, simulation and prepare-only output are allowed within policy. State-changing, external, private-data and expensive actions require the applicable gates and confirmation.

## D-008 — global_user_id is the root of personal identity
Platform IDs are links only. Personal memory, projects, settings, permissions and sources are isolated by global identity and scope.

## D-009 — Memory and Self Knowledge layers are distinct
Session context, confirmed user memory, user×group memory, shared group memory, thread/topic memory, confirmed project memory, System Self Knowledge, dialogue archive, topic digest, external evidence and runtime state must not be mixed. Raw dialogue never becomes confirmed memory automatically. System Self Knowledge is SG-owned structured knowledge about SG itself and is not user/group/project memory.

## D-010 — Sources and AI are not automatically truth
Factual claims requiring verification must use available sources or clearly disclose uncertainty. AI output, chat history and summaries are not verified evidence by themselves.

## D-011 — Capabilities are contract-driven and replaceable
Every capability declares input, output, action class, permissions, source/tool needs, risk, cost, confirmation, timeout, retry, observability and fallback behavior.

## D-012 — Transports are thin adapters
Transports receive input, resolve channel metadata and identity links, create CanonicalRequest and deliver responses. They do not own semantics, durable memory, permissions, capability selection, domain logic or final response-language policy.

## D-013 — Domain modules cannot redefine the core
Crypto, psychology support, repository analysis, documents, billing and other domains consume platform contracts. They cannot change SG identity or core execution flow.

## D-014 — Architecture changes require explicit monarch approval
Global architecture changes must be accepted here before implementation. Implementation convenience cannot silently change SG principles.

## D-015 — Completion comes from evidence
Pillars contain no manual done/status markers. Completion is derived from code, tests and verified runtime evidence.

## D-016 — Development order is fixed by the active roadmap
The canonical order is:

```text
Constitution
→ Semantic Kernel
→ Context and Memory
→ AI Routing Foundation
→ Decision Engine
→ Action Gate
→ Capability System
→ Identity and Scope
→ Observability
→ Interfaces
→ Automation and Agents
→ Domain Modules
→ Runtime Composition
→ PostgreSQL Persistence
→ Durable Automation and Workers
→ Telegram Production Integration
→ Production AI Integration
→ Production Capabilities
→ Temporal Context
→ Language & Locale Context
→ Configuration & Policy Layer
→ Secrets & Credentials Management
→ External Connections Registry
→ Resource Ownership & Authority Model
→ Session & Conversation Context
→ User Settings & Preferences
→ Notification & Delivery Router
→ Internal Event Bus
→ Schema & Contract Versioning
→ Feature Flags & Controlled Rollout
→ Self Knowledge / System Self-Awareness
→ Monarch Control / Owner Security
→ Memory 2.0 (M1–M9)
→ Render Deployment
→ End-to-End Verification
→ Security and Operations
→ Pilot Launch
```

Blocks 0–10 form the platform-core program. Blocks 11–19, intermediate Blocks 16.5–16.18, the Memory 2.0 M1–M9 program and Pilot Launch form the production continuation. Production roadmap details remain in `pillars/roadmap/PRODUCTION_ROADMAP.md`; Memory 2.0 details are canonical in `pillars/roadmap/MEMORY_2_0_ROADMAP.md`.

## D-017 — Development procedure is fixed by workflow
Every implementation block follows: scope → contracts → skeleton → config → minimal logic → tests → observability → safety → architecture verification → reversible commit → evidence.

## D-018 — Historical SG 2.0 documentation is not active truth
Old runtime notes, command architecture, Human/Technical Mode documents, RepoStateAgent-specific architecture, old module contracts and old stage numbering must not be restored into active pillars.

## D-019 — Identity resolution is centralized and scoped
Identity links, actor resolution and scope construction belong to the Identity layer. Transports provide platform facts but cannot grant roles, merge identities or broaden scope.

## D-020 — Observability is mandatory and privacy-bounded
Every important request, model call, capability execution, gate decision and failure carries trace context. Audit, telemetry and debug data are separated, secrets are redacted, and private content is minimized.

## D-021 — Production AI access is introduced through Block 2.5
After Semantic Kernel and Context and Memory are stable, the first production reasoning provider is connected only through AI Router. Direct provider calls from SG modules are forbidden. Decision Engine development begins only after the routed reasoning path is validated by tests and CI evidence.

## D-022 — Productionization preserves the approved core architecture
The production continuation may compose modules, replace reference providers with durable implementations, connect real transports and AI providers, deploy services and add operational controls. It must not bypass or relocate Semantic Kernel, Identity and Scope, Decision Engine, Action Gate, Capability contracts, AI Router, memory boundaries, trust order or observability responsibilities.

Production readiness requires real runtime evidence. Unit tests or a successful process start alone cannot prove Telegram delivery, persistence, worker recovery, deployment safety or pilot readiness.

## D-023 — SG is multilingual by one shared core
SG must not have separate language-specific versions. Users may communicate in any natural language that the connected reasoning model can understand. SG resolves message language, preferred language, conversation language, locale and response language through one transport-independent Language & Locale Context.

The original user text remains available to Semantic Kernel; ordinary multilingual communication must not require mandatory pre-translation. Language commands, keywords or phrase bindings are not required interaction mechanisms. Preferred language belongs to `global_user_id`, not to a single platform account. Transports may provide locale/language hints but cannot own final response-language policy. AI providers may execute within SG-selected language context but do not become the owner of that policy.

Language handling must preserve existing identity, scope, memory, Decision Engine, Action Gate, Capability System, AI Router, Temporal Context and observability boundaries.

## D-024 — Foundational control layers precede Render deployment
Before Block 17 deployment is treated as the next mandatory production stage, SG must explicitly implement and verify Blocks 16.7–16.18: Configuration & Policy, Secrets & Credentials, External Connections Registry, Resource Ownership & Authority, Session & Conversation Context, User Settings & Preferences, Notification & Delivery Router, Internal Event Bus, Schema & Contract Versioning, Feature Flags & Controlled Rollout, Self Knowledge / System Self-Awareness, and Monarch Control / Owner Security.

These layers are transport-independent and must preserve all existing core authority boundaries. In particular:

- Identity answers who the actor is.
- Scope answers where the request is bounded.
- Access/capability policy answers what kind of action is permitted.
- Resource Ownership & Authority answers over which specific resource the actor may act.
- A connection is not identity and does not itself prove resource ownership.
- Raw secrets are never ordinary memory, Self Knowledge, prompt context or telemetry.
- Conversation state is not confirmed long-term memory.
- User preferences cannot weaken mandatory safety or authorization policy.
- Delivery cannot target unauthorized users or resources.
- Internal events cannot bypass Decision Engine, Action Gate or Capability execution boundaries.
- Contract-version adapters cannot broaden trust, scope or permissions.
- Feature flags may restrict or disable availability but cannot grant permissions, ownership or authority.
- System Self Knowledge cannot grant authority and cannot be rewritten by ordinary user/model text.
- Identity, ownership or authority must never depend on secret words, commands, phrases or keyword hacks.

Canonical architecture for these layers is defined in `pillars/architecture/FOUNDATIONAL_CONTROL_LAYERS.md`, `pillars/architecture/SELF_KNOWLEDGE.md` and `pillars/architecture/MONARCH_OWNER_SECURITY.md`.

## D-025 — SG maintains a dedicated System Self Knowledge layer
SG must maintain a structured, versioned and provenance-aware model of itself that is separate from user memory and project memory.

System Self Knowledge may describe SG identity, purpose, architecture, capabilities, modules, integrations, development status and limitations, but it must distinguish `implemented`, `partial`, `planned`, `disabled`, `broken` and `unknown` states.

Roadmap text alone does not prove implementation. User text and AI output cannot redefine canonical SG identity, owner or architecture truth. Raw secrets never enter Self Knowledge. Live operational claims still require diagnostics/runtime evidence when current state matters.

The canonical architecture is `pillars/architecture/SELF_KNOWLEDGE.md`; implementation is Block 16.17.

## D-026 — Memory 2.0 is the canonical completion program for SG memory
SG must complete memory through the M1–M9 program defined in `pillars/architecture/MEMORY_2_0.md`, `pillars/roadmap/MEMORY_2_0_ROADMAP.md` and `pillars/workflow/MEMORY_2_0_WORKFLOW.md`.

Memory 2.0 extends the existing memory/context foundation; it does not replace `global_user_id`, Conversation Context, trust/provenance, PostgreSQL durability, Action Gate or Resource Authority.

Shared group memory is a first-class group/resource scope and must not be represented as a fake personal owner. Personal memory follows a verified `global_user_id` across transports, while group/resource memory remains local to its authorized resource scope.

Private memory cannot become shared memory implicitly. Scope/privacy authorization must occur before recall content reaches semantic processing. Automatic capture cannot turn raw dialogue into confirmed truth. Consolidation preserves provenance/history and cannot silently increase trust. Expired/superseded memory is excluded from ordinary recall.

Memory cannot grant identity, roles, permissions, ownership or resource authority, and raw secrets never become ordinary memory.

## D-027 — Universal Diagnostics is an independent observer program
SG 2.1 must have a universal diagnostic system capable of determining where execution first diverged from the expected path, separating primary root cause from downstream symptoms, and grounding conclusions in explicit evidence.

Universal Diagnostics is a separate cross-cutting program and independent application, not a new SG core reasoning layer and not a mandatory hop in ordinary request execution. SG-side responsibility is limited to versioned, privacy-bounded diagnostic facts and approved read-only observation surfaces. The external Diagnostics application owns collection, trace reconstruction, expected-path/invariant checking, first-divergence analysis, deterministic root-cause analysis, deployment/runtime diagnostics, isolated live diagnostic tests, replay/regression evidence and diagnostic reporting.

The following boundaries are mandatory:

- SG must continue operating when Diagnostics is unavailable;
- Diagnostics is read-only by default and cannot silently edit code/configuration, deploy, mutate production state, grant roles/permissions/ownership/authority, or repair SG automatically;
- Diagnostics cannot bypass Identity, Scope, Action Gate, Resource Authority or Monarch/Owner Security;
- synthetic diagnostic traffic must be explicitly marked and isolated from ordinary confirmed memory, user settings, profile/psychological adaptation and ordinary persistent tasks;
- diagnostic conclusions require evidence, and missing evidence lowers confidence instead of being guessed;
- historical incidents/signatures may guide investigation but cannot prove the current cause;
- deterministic diagnostic findings are authoritative; AI may explain findings but cannot independently promote a cause to `CONFIRMED`;
- full diagnostic evidence is privileged and must be owner-secured and secret-safe;
- the Diagnostics application must be independently deployable/reversible, with least-privilege read-only credentials and no hard runtime dependency from SG.

The canonical architecture is `pillars/architecture/UNIVERSAL_DIAGNOSTICS.md`; implementation program is `pillars/roadmap/UNIVERSAL_DIAGNOSTICS_PROGRAM.md`; implementation/verification procedure is `pillars/workflow/UNIVERSAL_DIAGNOSTICS_WORKFLOW.md`.

## D-028 — SG maintains Project Development Knowledge as an evidence-backed project biography
SG must maintain structured knowledge of how SG itself is conceived, designed, implemented, reworked, tested, deployed, verified and planned over time.

Project Development Knowledge 4.0 is a cross-cutting development-history/project-evolution program built on the completed Project Memory 3.0 foundation. It is not a new memory database or independent source of identity, authority or truth. Project Memory 3.0 remains responsible for durable project facts, provenance, trust, confirmation, deduplication/conflicts, temporal supersession, retrieval and Context Guard.

PDK4 must reconstruct relevant historical development from earliest verified evidence and then maintain it incrementally from new verified source events. It must preserve origin, requirements, proposals, accepted decisions and rationale, alternatives, implementation, refactors/rework, bugs/incidents/fixes, test/CI evidence, deployment/runtime evidence, supersession, current state and next plans.

The following boundaries are mandatory:

- `implemented`, `ci-verified`, `deployed` and `live-verified` are distinct evidence states and cannot be silently promoted into one another;
- raw chat and model output cannot self-confirm as project truth;
- AI may assist classification, extraction, clustering and summarization only through AI Router and cannot grant trust or mutate Project Memory directly;
- historical/superseded facts remain queryable but cannot override current-state truth;
- source replay is idempotent and historical scanning is bounded, resumable and checkpointed durably;
- the system must prefer significant product/architecture changes over trivial repository churn;
- missing or contradictory evidence becomes an explicit gap/conflict rather than an invented conclusion;
- no raw secrets, private user data, roles, permissions, ownership or authority grants may be stored or inferred by PDK4;
- live operational diagnosis remains the responsibility of current runtime/diagnostic evidence rather than historical similarity.

The canonical architecture is `pillars/architecture/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0.md`; implementation program is `pillars/roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md`; implementation/verification procedure is `pillars/workflow/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_WORKFLOW.md`.

## D-029 — SG automation is editable executable work, not only scheduled messages
SG automation must support durable, versioned executable workflows that can perform fresh authorized work at execution time, not only deliver a static message stored at creation time.

The following rules are mandatory:

- natural-language instructions may create or semantically modify an existing automation without requiring the user to know an internal task/schedule ID;
- modifications patch the same automation and create a new version; a duplicate automation is created only when the user explicitly requests a new/copy workflow;
- ambiguous or missing target resolution fails closed and asks for clarification rather than guessing;
- workflow execution may contain bounded `collect`, `retrieve`, `analyze`, `compose`, `invoke-capability` and `deliver` steps;
- dynamic reports collect fresh execution-time evidence rather than presenting previously composed text as current data;
- every protected execution re-evaluates current Identity/Scope, SG access/entitlement, Resource Ownership & Authority, Action Gate, applicable credentials/connections and capability/resource permission health;
- creation-time authority is not permanent execution authority;
- read-only autonomous work may run without per-occurrence confirmation only inside the active deterministic policy envelope;
- state-changing/external automated steps require an explicit bounded execution envelope and may not self-expand their scope, resources, capabilities or authority;
- Automation 2.0 reuses existing Temporal Context, Capability System, Durable Automation/Workers, Access Control, Resource Authority, Action Gate, Credential Manager, Delivery Router, PostgreSQL and Observability and must not create parallel control or scheduler stacks;
- retries, worker restarts and duplicate materialization must preserve occurrence idempotency and prevent duplicate externally visible delivery;
- AI may interpret workflow meaning or perform approved analysis only through AI Router and cannot grant access, fabricate deterministic metrics or bypass execution gates.

Canonical architecture: `pillars/architecture/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS.md`.
Implementation program: `pillars/roadmap/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_PROGRAM.md`.
Implementation/verification workflow: `pillars/workflow/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_WORKFLOW.md`.

## D-030 — GitHub development is one transport-neutral SG capability

SG must support instructed global GitHub discovery and complete durable development work inside explicitly authorized repositories through one internal GitHub Development Workspace.

The following rules are mandatory:

- Telegram, Discord, Web, API, Email, the future native SG interface and later transports are clients of the same GH3 service; no transport owns GitHub logic, credentials, authority or task state;
- a development task may continue across transports only through canonical Global ID, project/scope and approved conversation/task continuity;
- on explicit instruction SG may search and inspect public GitHub globally; private/restricted discovery requires an explicitly connected authorized provider identity/app installation;
- global discovery is read-only by default and search results do not grant mutation authority or become confirmed Project Memory automatically;
- authorized repository work may cover exact-HEAD/source verification, branches, atomic multi-file commits, PRs/reviews/issues, Actions/checks/logs/artifacts, bounded CI repair loops, tags/releases and separately gated administration;
- technical provider permission is not actor authority; execution requires ACS capability, current Resource Authority, Action Gate/risk policy and approved Credential Manager binding;
- protected-branch merge, secrets/environments/settings mutation and destructive administration are higher-risk, default-deny operations requiring separate authority/confirmation;
- durable PostgreSQL development-task state and idempotency must allow safe restart/resume without duplicate commits, PRs, comments, releases or workflow dispatches;
- GitHub content/logs/artifacts are untrusted external data and cannot authorize SG, widen scope or expose credentials through prompt injection;
- verified outcomes integrate through existing PDK4/Project Memory contracts and cannot falsely promote repository/CI evidence into deployed or live-verified state;
- current GET-only PDK4 GitHub reading must not be represented as implemented GH3 mutation/development capability.

Canonical architecture: `pillars/architecture/GITHUB_DEVELOPMENT_WORKSPACE_3_0.md`.
Implementation program: `pillars/roadmap/GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM.md`.
Implementation/verification workflow: `pillars/workflow/GITHUB_DEVELOPMENT_WORKSPACE_3_0_WORKFLOW.md`.

## D-031 — Adaptive AI Routing 2.0 extends the single canonical AI Router

SG must route AI work through one adaptive, transport-independent AI Router that selects the minimum sufficient intelligence for each task while preserving correctness, security and cost control.

The following rules are mandatory:

- the existing Block 2.5 AI Router remains the single canonical router; AR2 extends it and cannot create a second parallel router or direct provider bypass;
- SG first checks whether an existing deterministic executor can satisfy the request exactly (`L0`) before invoking a paid model;
- AI-requiring work is classified into capability tiers `L1` (low-cost extraction/classification/normalization), `L2` (general conversation/synthesis/planning) and `L3` (advanced debugging/architecture/deep reasoning);
- concrete provider/model product names are configuration, not SG domain/business logic;
- task assessment should be deterministic first and may use bounded complexity, reasoning-depth, risk, ambiguity, tool-depth, context-pressure, evidence-conflict and code/debugging signals;
- request length, transport or keywords such as GitHub/memory/task/automation cannot by themselves force a high tier;
- model tier and reasoning effort are independent controls and both use the lowest level that remains reliable for the task;
- cost optimization cannot route below the minimum reliable tier;
- deterministic/task-specific validation precedes semantic escalation where deterministic truth is available;
- provider fallback handles technical failure, while semantic escalation handles an insufficient but technically valid result; these mechanisms remain separate and bounded;
- a model/user cannot self-authorize a more expensive tier, broaden minimum/maximum routing policy, grant authority or bypass Access, Resource Authority, Action Gate, Owner Security or Credential Manager;
- Telegram, Discord, Web/API, Email, voice and future native SG interfaces use the same AR2 policy; transports do not own model/tier selection;
- routing telemetry must distinguish model/tier, reasoning effort, routing reason, assessment, validation, fallback, escalation and estimated/actual cost when available;
- technical AI usage accounting must preserve per-call provider/model/tier and available input/cached/output/reasoning/other billable units, and aggregate them per user request/task and authorized reporting period;
- provider/model pricing, exchange rates, user-facing credit conversion, markups/discounts, budget thresholds and routing weights are mutable configuration/policy, not permanent architecture constants;
- pricing must be effective-dated/versioned, and completed model calls retain the pricing version/snapshot used when their cost was calculated so later tariff changes do not silently rewrite historical cost;
- historical pricing corrections must be explicit adjustment/reconciliation evidence rather than destructive rewriting; original and corrected/calculated/provider-reported cost may coexist with provenance;
- provider-reported post-call usage is preferred over estimates when available, while pre-call estimates remain explicitly marked as estimates;
- future AI credits/subscriptions/free allowances/user tariffs are a mutable commercial policy layer over canonical technical usage accounting and cannot change underlying historical provider consumption evidence;
- AR2 documentation does not prove implementation; AR2.1–AR2.10 require code, tests/regressions, `npm run check` and exact-HEAD SG 2.1 CI evidence before closure.

Canonical architecture: `pillars/architecture/ADAPTIVE_AI_ROUTING_2_0.md`.
Implementation/acceptance stages: `pillars/roadmap/02_5_AI_ROUTING_FOUNDATION.md`.
