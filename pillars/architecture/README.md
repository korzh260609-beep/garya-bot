# SG 2.1 — ARCHITECTURE INDEX

This directory defines how SG 2.1 is structured. Architecture does not contain roadmap order, implementation status, deployment history or runtime reports.

## Authority

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

## Canonical definition
SG 2.1 is one global transport-independent project system whose reasoning layer is provided by connected AI models. SG code organizes context, memory, sources, capabilities, identity, access, safety, execution and evidence.

## Canonical documents
1. `SG21_SYSTEM.md`
2. `SEMANTIC_KERNEL.md`
3. `CONTEXT_AND_MEMORY.md`
4. `MEMORY_2_0.md`
5. `PROJECT_MEMORY_3_0.md`
6. `PROJECT_DEVELOPMENT_KNOWLEDGE_4_0.md`
7. `PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md`
8. `TELEGRAM_WORKSPACE_MANAGER_1_0.md`
9. `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS.md`
10. `SG_ACCESS_CONTROL_SYSTEM_1_0.md`
11. `AUTOMATION_2_0_EXECUTABLE_WORKFLOWS.md`
12. `GITHUB_DEVELOPMENT_WORKSPACE_3_0.md`
13. `DECISION_AND_ACTION_GATE.md`
14. `CAPABILITY_SYSTEM.md`
15. `IDENTITY_AND_SCOPE.md`
16. `OBSERVABILITY.md`
17. `TRANSPORTS_AND_AI_ROUTING.md`
18. `ADAPTIVE_AI_ROUTING_2_0.md`
19. `LANGUAGE_AND_LOCALE_CONTEXT.md`
20. `FOUNDATIONAL_CONTROL_LAYERS.md`
21. `SELF_KNOWLEDGE.md`
22. `MONARCH_OWNER_SECURITY.md`
23. `RUNTIME_COMPOSITION.md`
24. `POSTGRESQL_PERSISTENCE.md`
25. `UNIVERSAL_DIAGNOSTICS.md`

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
→ SG Access Control / Entitlement / Usage evaluation
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

Project Memory 3.0 is the specialized project-knowledge program inside the Memory 2.0 Project Memory domain. It adds evidence-backed project facts, trusted-source ingestion, candidate/confirmation, duplicate/conflict handling, temporal supersession, bounded relations, hybrid semantic/metadata retrieval and a Project Memory Context Guard. It does not replace System Self Knowledge or live diagnostics and cannot treat Render as a live source until a real Render Connector exists.

Project Development Knowledge 4.0 is the development-history and project-evolution layer built on Project Memory 3.0. It reconstructs and continuously maintains SG's evidence-backed product biography: origin, requirements, proposals, decisions and rationale, implementation, rework, incidents/fixes, CI/deployment/runtime verification, supersession, current state and next plan. It reuses PM3 storage/trust/provenance/temporal/retrieval boundaries and must not become a parallel memory, authority, identity or diagnostics system.

PDK4.13 Live Production Wiring & Autonomous Project History is the production-composition extension of the completed PDK4.1–PDK4.12 software baseline. It wires historical bootstrap/resume, incremental reconciliation, bounded polling, PostgreSQL single-flight protection, protected diagnostics and live acceptance into the real SG production runtime. It reuses the existing PDK4 engine and PM3 substrate rather than creating a new memory path.

Telegram Workspace Manager 1.0 is a cross-cutting management layer over the existing Telegram production transport/runtime. It lets any authorized SG user manage SG behavior for their own Telegram groups, supergroups and channels through native Telegram UI and natural language. TWM1 reuses canonical `global_user_id`, Identity/Scope, Resource Authority, Action Gate, PostgreSQL, Memory 2.0 isolation, AI Router, Durable Automation and Observability. TWM1.14 extends this same workspace-scoped backend with text/media publication, polls, quiz/test sessions, scheduled content, deterministic result collection/statistics and optional AI Router interpretation. Telegram administrator status remains workspace-scoped evidence only and never SG-global owner/Monarch authority. AI/model output may propose configuration/content or analyze a computed result snapshot, but cannot write state directly, grant authority or invent numeric poll/test results.

TWM1.15 Community Operations, Engagement & Analytics extends the same workspace backend with five bounded functional packages: `TWM Content`, `TWM Engagement`, `TWM Community`, `TWM Operations` and `TWM Analytics`. It adds multi-step forms/questionnaires, feedback, event/RSVP/waitlist flows, contests/challenges with auditable deterministic mechanics, FAQ and newcomer onboarding, unanswered-question and moderation workflows, request/case queues, task/reminder/decision workflows, content planning/recurring rubrics, bounded discussion summaries, deterministic workspace analytics, owner briefs and authorized exports. It MUST reuse Memory 2.0, Conversation Context, existing task/capability and Durable Automation systems rather than creating parallel stores or schedulers.

SG Access Control System 1.0 (ACS1) is the canonical transport-neutral access, entitlement, scoped-capability, delegation and usage/budget layer. It applies equally to Telegram, Discord, Web, API, Email and the future native SG interface. Identity existence, transport login, workspace membership/admin status and private-result delivery never imply conversational AI entitlement. SG is the default Access Authority inside the Monarch-defined deterministic policy envelope; human approval is escalation when policy requires it. AI/model output may interpret a requested capability but cannot produce the final GRANT/DENY/ESCALATE decision. Denied AI/usage paths MUST terminate before AI Router so unauthorized users cannot spend model budget. ACS composes with, and does not replace, Resource Authority, Owner Security, Action Gate or Credential Manager.

Automation 2.0 — Executable Workflows is the cross-cutting automation extension above the existing durable task/schedule/worker substrate. It defines a task as a versioned executable plan rather than only a stored message. SG may semantically identify and patch the same automation, execute ordered collect/retrieve/analyze/compose/invoke-capability/deliver steps, gather fresh authorized data at run time, and retain version/execution history. Every protected step reuses current Identity/Scope, Access, Resource Authority, Action Gate, Credential Manager, Capability System, Temporal Context, Durable Automation, Delivery Router and Observability. It does not create a second scheduler, worker, authorization, credential or transport system.

GitHub Development Workspace 3.0 (GH3) is the planned transport-neutral GitHub discovery and development subsystem. It separates bounded global public/authorized-private discovery from state-changing authorized repository work, exposes one durable development service to every transport and future native SG interface, and composes ACS, Resource Authority, Action Gate, Credential Manager, PostgreSQL task state, GitHub Actions, PM3 and PDK4. Current GET-only PDK4 GitHub reading is not GH3 mutation implementation.

Adaptive AI Routing 2.0 (AR2) is the accepted planned extension of the existing AI Routing Foundation. It introduces the L0 deterministic/no-LLM gate, L1/L2/L3 model tiers, deterministic task assessment, minimum-sufficient tier selection, independent reasoning-effort selection, deterministic-first validation and bounded semantic escalation while preserving the existing single AIRouter, provider fallback, production policy, Action Gate and transport-independent boundaries. Concrete provider model names remain configuration rather than domain logic. Canonical architecture: `ADAPTIVE_AI_ROUTING_2_0.md`.

Self Knowledge is a shared system-context layer used for evidence-aware descriptions of SG itself. It does not sit as a mandatory reasoning hop in every request and does not replace live diagnostics.

Universal Diagnostics is an independent observer application outside the mandatory SG request path. SG emits bounded diagnostic facts through Observability and approved read-only surfaces; the separate Diagnostics application reconstructs traces, compares expected vs actual paths, finds first divergence, performs deterministic root-cause analysis, runs isolated synthetic checks, and produces evidence-backed reports. SG must continue operating if Diagnostics is unavailable.

## Non-negotiable boundaries
- Connected AI models provide reasoning and may also execute specialized tasks.
- SG code does not imitate reasoning with keyword routing.
- AR2 extends the existing AI Router and cannot create a second independent router or direct provider bypass.
- AR2 model tiers are capability/configuration classes; provider product names cannot become domain business logic.
- AR2 may choose minimum-sufficient tier/reasoning effort but model/user text cannot self-authorize a more expensive tier or bypass cost/security policy.
- AR2 provider fallback and semantic escalation are separate, bounded mechanisms; escalation cannot loop indefinitely.
- AR2 deterministic L0 execution is allowed only where an actual resolved deterministic executor can satisfy the request; it is not a phrase/keyword substitute for reasoning.
- Gates protect actions and do not become a second brain.
- Memory supplies bounded context and does not own SG identity.
- Memory 2.0 cannot broaden scope, privacy, authority or trust during capture/recall/consolidation.
- Project Memory 3.0 reuses Memory 2.0 scope/privacy/trust/provenance/lifecycle boundaries and cannot become a parallel authority or identity system.
- Project Memory facts require bounded provenance; raw chat/model output cannot become verified project truth automatically.
- Project Memory live-state claims prefer current authoritative evidence when an approved connector exists; unavailable connectors must produce uncertainty rather than invented current state.
- Project Development Knowledge 4.0 reuses Project Memory 3.0 as its durable fact/trust/history/retrieval substrate and cannot create a second project-memory store.
- PDK4 must distinguish `implemented`, `ci-verified`, `deployed` and `live-verified`; evidence from one state cannot silently promote another.
- PDK4 historical/superseded facts remain available for history but cannot override current-state retrieval.
- PDK4 raw chat/model output cannot self-confirm, and AI summaries/classifications are not primary evidence.
- PDK4.13 production wiring must be resumable, bounded, idempotent and single-flight per project/repository; concurrent triggers cannot duplicate history processing.
- PDK4.13 GitHub/provider degradation must degrade the project-history subsystem rather than take normal SG transports offline by default.
- PDK4.13 credentials/secrets never enter PM3/PDK4 facts, AI context, ordinary diagnostics or observability payloads.
- TWM1 cannot create a second Telegram transport, identity root, authorization system or direct AI→configuration/content/result path.
- TWM1 workspace configuration, members, memory, automation, media, drafts, publications, poll/test results and audit are isolated per canonical workspace scope.
- TWM1 Telegram administrator evidence cannot grant SG-global ownership/Monarch authority.
- TWM1 must re-verify revocable Telegram authority according to action sensitivity and fail closed when required bot permissions are absent.
- TWM1 scheduled external actions must reuse durable automation and must not rely indefinitely on creation-time authority.
- TWM1 exact poll/test totals, percentages and scores must come from deterministic structured evidence, not model output.
- TWM1 must preserve anonymous Telegram poll semantics and cannot claim participant identity for anonymous votes.
- TWM1 configuration/content behavior cannot weaken mandatory security, owner security, privacy or Action Gate requirements.
- TWM1.15 operational records are not Memory 2.0 facts by default; forms, cases, feedback, event registrations and analytics require explicit memory-promotion policy before becoming shared durable memory.
- TWM1.15 private form/case/feedback data cannot leak through FAQ, summaries, analytics, exports or Group Shared Memory.
- TWM1.15 poll/test results do not automatically become binding decisions; decision confirmation is a separate authorized transition.
- TWM1.15 AI output may classify, summarize or interpret but cannot mutate state, execute moderation, fabricate analytics, grant authority or create confirmed shared truth.
- TWM1.15 tasks/reminders/content schedules must reuse the existing task/capability/Durable Automation systems instead of creating parallel execution engines.
- TWM1.15 anonymity claims must match actual Telegram/storage evidence; SG must not promise anonymity when identifiers are retained.
- ACS1 is the single SG-wide access/entitlement policy truth; transports and domain modules cannot create parallel authorization truth.
- ACS1 identity bootstrap, login, `/start`, workspace membership/admin facts and delivery flows cannot implicitly grant `ai.compose` or equivalent paid conversational capability.
- ACS1 private own-result access cannot imply general AI access or access to another subject's result.
- ACS1 final access decisions are deterministic; AI/model output may propose intent/capability only and cannot grant, revoke or expand authority.
- ACS1 denied AI or exhausted-budget paths must terminate before AI Router/paid model execution.
- ACS1 delegated authority cannot exceed its active delegation envelope and cannot self-expand.
- ACS1 cannot bypass or weaken Owner/Monarch Security, Resource Authority, Action Gate or Credential Manager.
- Automation 2.0 updates patch the same automation/version lineage unless the user explicitly requests a new/copy automation.
- Automation 2.0 target resolution must fail closed when zero or multiple existing automations match; internal IDs are not required user knowledge.
- Automation 2.0 creation-time authority never becomes permanent run-time authority; protected steps re-check current access/resource/action/credential conditions.
- Automation 2.0 dynamic reports use fresh execution-time evidence and cannot present stale prepared output as current evidence.
- Automation 2.0 read-only composition cannot smuggle a state-changing capability, and state-changing steps require an explicit bounded execution envelope.
- Automation 2.0 must reuse the existing scheduler/worker/Temporal/Capability/Access/Resource Authority/Action Gate/Credential/Delivery/Observability stacks rather than create parallel ones.
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
