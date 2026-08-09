# SG 2.1 — PRODUCTION ROADMAP

## Purpose

Turn the completed SG 2.1 platform core into a deployable, persistent and operational product without changing the approved authority order or core boundaries.

The production stage must preserve these rules:

- Connected AI models provide controlled reasoning and specialized execution; SG owns context, decisions, permissions, risk and action control.
- No direct AI calls outside AI Router.
- Protected actions always pass Action Gate.
- Identity, permissions, scope, resource authority and trust order remain centralized.
- Transports provide platform facts but cannot assign roles, grants, resource ownership or final response-language policy.
- Domain modules cannot redefine Semantic Kernel, Identity, Action Gate or trust order.
- Secrets never become ordinary memory, Self Knowledge, prompt context or unrestricted telemetry.
- Conversation state is bounded dialogue continuity and never becomes confirmed memory automatically.
- Every production action must be observable and recoverable.

## Current baseline

Completed and acceptance-verified:

- Blocks 0–10 platform core;
- Block 11 — Runtime Composition;
- Block 12 — PostgreSQL Persistence;
- Block 13 — Durable Automation and Workers;
- Block 14 — Telegram Production Integration;
- Block 15 — Production AI Integration;
- Block 16 — Production Capabilities;
- Block 16.5 — Temporal Context;
- Block 16.6 — Language & Locale Context;
- Block 16.7 — Configuration & Policy Layer;
- Block 16.8 — Secrets & Credentials Management;
- Block 16.9 — External Connections Registry;
- Block 16.10 — Resource Ownership & Authority Model;
- Block 16.11 — Session & Conversation Context;
- Block 16.12 — User Settings & Preferences;
- Block 16.13 — Notification & Delivery Router;
- Block 16.14 — Internal Event Bus;
- Block 16.15 — Schema & Contract Versioning;
- Block 16.16 — Feature Flags & Controlled Rollout.

Current executable SG therefore already has the approved Semantic Kernel, memory/context boundary, AI Router, Decision Engine, Action Gate, Capability System, global identity/scope, observability, transport abstractions, durable PostgreSQL/worker foundations, Telegram production path, production AI path, Temporal Context, multilingual Language & Locale Context, centralized Configuration & Policy, bounded Secrets & Credentials, a durable External Connections Registry, verified Resource Authority enforcement for concrete resources, durable scoped conversation/session/topic continuity, global user settings, authorized delivery routing, a production-wired Internal Event Bus, production contract-version enforcement/quarantine, and controlled feature flags.

Repository-wide audit hardening after Block 16.16 additionally closed cross-module observability contract mismatches, normalized feature-disabled capability results, bound Domain Runtime execution to the same canonical GateDecision actor/scope, and made Render startup rollback-safe. These are corrections within completed blocks, not a new roadmap block.

## Current implementation boundary

- Blocks 11–16.16 listed above are completed and implementation-verified.
- Block 16.17 — Self Knowledge / System Self-Awareness is planned next.
- Block 16.18 — Monarch Control / Owner Security follows after Block 16.17.
- Block 17 — Render Deployment follows only after Blocks 16.17 and 16.18 are implementation- and acceptance-verified.
- Blocks 18–19 and Pilot Launch remain subsequent stages.

---

# Completed production blocks

## Block 11 — Runtime Composition
**Status:** Completed.

One executable runtime composition root, validated configuration, lifecycle, health/readiness, graceful shutdown and complete deterministic local production-like path.

Acceptance evidence: `11_RUNTIME_COMPOSITION.md`.

## Block 12 — PostgreSQL Persistence
**Status:** Completed.

Durable PostgreSQL boundary, versioned database migrations, identity/access/conversation/memory/task/idempotency/observability/domain persistence and transaction isolation.

Acceptance evidence: `12_POSTGRESQL_PERSISTENCE.md`.

## Block 13 — Durable Automation and Workers
**Status:** Completed.

Persistent queue/scheduler, separate worker runtime, atomic claiming, leases, heartbeat, retry/backoff, DLQ, recovery, approval/cancellation/idempotency and protected execution through Action Gate.

Acceptance evidence: `13_DURABLE_AUTOMATION_AND_WORKERS.md`.

## Block 14 — Telegram Production Integration
**Status:** Completed.

Webhook verification, durable update deduplication, Telegram Bot API delivery, flood-control handling, private/group/topic routing and semantic-first natural-language input through the full SG runtime.

Acceptance evidence: `14_TELEGRAM_PRODUCTION_INTEGRATION.md`.

## Block 15 — Production AI Integration
**Status:** Completed.

Production model execution only through AI Router, model registry/fallback, emergency disable, sensitive-context boundary, output validation, timeout/retry, role cost controls and model-call observability.

Acceptance evidence: `15_PRODUCTION_AI_INTEGRATION.md`.

## Block 16 — Production Capabilities
**Status:** Completed.

Real conversational, memory, task, source, document, repository, diagnostics and domain-dispatch capabilities through existing Registry → Action Gate → Executor boundaries.

Acceptance evidence: `16_PRODUCTION_CAPABILITIES.md`.

## Block 16.5 — Temporal Context
**Status:** Completed.

Canonical UTC/user-local time, global-user timezone persistence, relative-time resolution, normalized scheduling, temporal recall and DST-aware recurrence.

Acceptance evidence: `16_5_TEMPORAL_CONTEXT.md`.

## Block 16.6 — Language & Locale Context
**Status:** Completed.

Transport-independent message/preferred/conversation/response language, locale separation, natural switching, AI-router fallback, multilingual response composition, global-user language preference persistence and bounded language observability.

Acceptance evidence: `16_6_LANGUAGE_AND_LOCALE_CONTEXT.md`.

## Block 16.7 — Configuration & Policy Layer
**Status:** Completed.

Typed centralized configuration/policy resolution with validated defaults and environment inputs, explicit defaults → environment → project → role precedence, immutable effective-policy provenance, safe hot-reload allowlist, Action Gate source/risk/cost policy consumption, capability retry/timeout tightening, AI operational-limit composition and secret-free policy observability.

Acceptance evidence: `16_7_CONFIGURATION_AND_POLICY_LAYER.md`.

## Block 16.8 — Secrets & Credentials Management
**Status:** Completed.

Stable credential handles, deployment secret-store adapters, permission/scope-bound use, lifecycle controls, secret-free audit evidence and bounded OpenAI/Telegram provider access without propagating raw credentials through ordinary config, memory, prompts or telemetry.

Acceptance evidence: `16_8_SECRETS_AND_CREDENTIALS_MANAGEMENT.md`.

## Block 16.9 — External Connections Registry
**Status:** Completed.

Stable external connection records, provider/account metadata, owner/project scope, Block 16.8 credential handles, explicit scopes/permissions/capabilities, health/lifecycle state, PostgreSQL persistence, audit/discovery APIs, deployment bootstrap, and fail-closed OpenAI/Telegram provider gating.

Acceptance evidence: `16_9_EXTERNAL_CONNECTIONS_REGISTRY.md`.

## Block 16.10 — Resource Ownership & Authority Model
**Status:** Completed.

Stable verified resource records and authority relations, explicit owner/admin/manager/read/publish/modify semantics, delegation/revocation/expiry, resource hierarchy with opt-in descendant inheritance, PostgreSQL persistence, connection linkage without ownership inference, runtime authority resolution and fail-closed Action Gate enforcement for resource-targeted actions.

Acceptance evidence: `16_10_RESOURCE_OWNERSHIP_AND_AUTHORITY_MODEL.md`.

## Block 16.11 — Session & Conversation Context
**Status:** Completed.

Canonical durable conversations, transport-bound sessions, topic/reply relationships, explicit start/continue/topic-shift/closure lifecycle, scoped external message linkage, bounded recent dialogue context, explicit approved cross-transport continuation, PostgreSQL restart continuity, Language/Semantic runtime integration and privacy-bounded transition observability without automatic promotion into confirmed memory.

Acceptance evidence: `16_11_SESSION_AND_CONVERSATION_CONTEXT.md`.

---

# Completed foundational continuation before Render

These blocks complete core control, ownership, continuity, extensibility and rollout foundations. Block 16.17 adds canonical Self Knowledge, and Block 16.18 adds the explicit owner-security boundary before deployment becomes the next mandatory stage.

Canonical dependency direction:

```text
16.7 Configuration & Policy [completed]
→ 16.8 Secrets & Credentials [completed]
→ 16.9 External Connections Registry [completed]
→ 16.10 Resource Ownership & Authority [completed]
→ 16.11 Session & Conversation Context [completed]
→ 16.12 User Settings & Preferences [completed]
→ 16.13 Notification & Delivery Router [completed]
→ 16.14 Internal Event Bus [completed]
→ 16.15 Schema & Contract Versioning [completed]
→ 16.16 Feature Flags & Controlled Rollout [completed]
→ 16.17 Self Knowledge / System Self-Awareness [planned, next]
→ 16.18 Monarch Control / Owner Security [planned]
→ 17 Render Deployment
```

Architecture coordination: `../architecture/FOUNDATIONAL_CONTROL_LAYERS.md`, `../architecture/SELF_KNOWLEDGE.md` and `../architecture/MONARCH_OWNER_SECURITY.md`.

---

# Block 16.7 — Configuration & Policy Layer

## Status
Completed and acceptance-verified.

## Goal
Create one authoritative typed configuration/policy layer so runtime defaults, limits and operational policies are not scattered through transports, capabilities or hidden constants.

## Required scope
- typed runtime configuration;
- explicit defaults and environment overrides;
- policy precedence/inheritance;
- AI, capability, source, autonomy and delivery policy inputs;
- effective-policy provenance;
- fail-closed validation;
- safe reload only where explicitly supported;
- privacy-bounded diagnostics.

## Boundaries
- policy is not identity or authorization;
- config cannot bypass Action Gate;
- secrets are references handled by Block 16.8;
- environment variables are inputs, not the architecture itself.

## Acceptance criteria
- [x] effective policy is deterministic and inspectable;
- [x] conflicts resolve by explicit precedence;
- [x] invalid mandatory configuration fails safely;
- [x] modules consume centralized policy contracts for Block 16.7 surfaces rather than hidden duplicate limits;
- [x] automated tests cover defaults, overrides, invalid combinations, safe reload and policy enforcement.

Detailed specification and evidence: `16_7_CONFIGURATION_AND_POLICY_LAYER.md`.

---

# Block 16.8 — Secrets & Credentials Management

## Status
Completed and acceptance-verified.

## Goal
Create a first-class secret/credential boundary for external service use without placing raw credentials in memory, prompts, ordinary config or logs.

## Required scope
- secret references/handles;
- API key, bot token, OAuth and service credential lifecycle;
- ownership/scope metadata;
- permission-bound access;
- rotation, revocation and expiry;
- deployment secret-store integration;
- redaction and audit without secret values;
- user/project/connection isolation.

## Boundaries
- raw secrets never become confirmed memory or ordinary ContextBundle data;
- credential possession does not grant authorization;
- protected use still depends on Action Gate and resource authority where applicable.

## Acceptance criteria
- [x] production secrets are absent from repository and unrestricted telemetry by design;
- [x] revoked/expired credentials fail visibly;
- [x] credential use is auditable by purpose without exposing values;
- [x] cross-user/project/connection/resource leakage tests pass.

Detailed specification and evidence: `16_8_SECRETS_AND_CREDENTIALS_MANAGEMENT.md`.

---

# Block 16.9 — External Connections Registry

## Status
Completed and acceptance-verified.

## Goal
Create one authoritative inventory and lifecycle model for external service/account connections available to SG.

## Required scope
- stable `connection_id`;
- provider/service type and external account metadata;
- owning `global_user_id`/project context where applicable;
- credential reference from Block 16.8;
- approved scopes/permissions;
- provided capabilities;
- status/health/last verification;
- connect/reconnect/revoke lifecycle;
- persistence and observability.

## Boundaries
- a connection is not identity;
- a connection does not prove ownership of every external resource;
- raw credentials are not stored in registry records;
- state changes remain permission-bound and audited.

## Acceptance criteria
- [x] SG can determine which services/accounts are connected and under whose authority;
- [x] multiple accounts for one provider remain distinguishable;
- [x] unavailable/revoked connections cannot silently execute;
- [x] connection state survives restart and remains scope-isolated.

Detailed specification and evidence: `16_9_EXTERNAL_CONNECTIONS_REGISTRY.md`.

---

# Block 16.10 — Resource Ownership & Authority Model

## Status
Completed and acceptance-verified.

## Goal
Give SG an explicit verified model of which resources an actor/project owns, manages, administers or may act upon.

## Canonical separation

```text
Identity           = WHO is acting
Scope              = WHERE the request is bounded
Access              = WHAT action/capability is permitted
Resource Authority = OVER WHICH RESOURCE the actor may act
```

## Required scope
- stable `resource_id` and resource type;
- platform/provider external reference;
- owner/manager/admin/read/publish/modify relations;
- actor/project/resource relationships;
- resource hierarchy where needed;
- authority provenance and verification;
- delegation, expiry and revocation;
- integration with Identity, Scope, Connections, Capabilities and Action Gate;
- audited authority changes.

## Boundaries
- membership does not prove ownership;
- adding SG to a group/channel does not grant unrestricted authority;
- connection possession does not prove ownership of provider resources;
- authority cannot merge identities or broaden scope;
- parent authority only applies to descendants when explicitly configured;
- generic permissions do not replace resource authority;
- no identity/authority secret words, commands, phrases or keyword hacks.

## Acceptance criteria
- [x] owner/admin/manager/participant are distinguishable;
- [x] multiple resources of one user remain independently addressable;
- [x] different users' channels/groups/repositories cannot be confused;
- [x] delegation is explicit, bounded, revocable and auditable;
- [x] hierarchy inheritance is explicit and tested;
- [x] revoked/expired/unverified authority fails closed;
- [x] resource state and authority survive restart and remain project-isolated;
- [x] Action Gate denies missing or mismatched resource authority evidence.

Detailed specification and evidence: `16_10_RESOURCE_OWNERSHIP_AND_AUTHORITY_MODEL.md`.

---

# Block 16.11 — Session & Conversation Context

## Status
Completed and acceptance-verified.

## Goal
Create a canonical model of conversations, sessions, topics and reply continuity independently from confirmed long-term memory.

## Required scope
- [x] `conversation_id` and optional `session_id`;
- [x] user/project/group/thread binding;
- [x] topic and reply-chain relationships;
- [x] start/continue/topic-shift/closure state;
- [x] approved cross-device/cross-transport continuation;
- [x] durable restart continuity;
- [x] bounded recent dialogue context;
- [x] Language/Semantic/Context integration;
- [x] privacy-bounded transition observability.

## Boundaries
- conversation state is not confirmed memory;
- separate conversations and transport sessions do not automatically merge;
- group/thread scope remains authoritative;
- cross-transport continuation requires explicit prior approval;
- transports provide reply/thread/session facts but do not own semantic conversation state;
- recent-turn text is not duplicated into ordinary capability payloads or transition telemetry.

## Acceptance criteria
- [x] SG distinguishes new conversation from continuation;
- [x] topic shifts do not corrupt unrelated context;
- [x] two conversations for one user can coexist without contamination;
- [x] reply/thread chains remain correctly scoped;
- [x] restart continuation is deterministic;
- [x] approved cross-transport continuation is deterministic and fail-closed before approval;
- [x] cross-user/group/thread recent-context leakage tests pass;
- [x] conversation state remains separate from confirmed long-term memory.

Detailed specification and evidence: `16_11_SESSION_AND_CONVERSATION_CONTEXT.md`.

---

# Block 16.12 — User Settings & Preferences

## Status
Completed and acceptance-verified.

## Goal
Create one typed settings layer keyed by `global_user_id` rather than separate preference mechanisms for every subsystem.

## Required scope
- canonical UserSettings contract;
- language, locale and timezone;
- response presentation/length;
- units/date/number/accessibility preferences where supported;
- notification and preferred-delivery preferences;
- autonomy/confirmation preferences only within mandatory safety policy;
- explicit-vs-inferred provenance;
- defaults/project overrides where allowed;
- persistence/versioning and authorized read/write paths.

## Boundaries
- preferences cannot weaken mandatory safety, permissions or Action Gate;
- inferred values cannot silently overwrite explicit settings;
- platform settings/locale remain hints, not authoritative duplicates.

## Acceptance criteria
- [x] one linked global user retains approved settings across transports;
- [x] explicit settings deterministically override defaults/hints;
- [x] settings survive restart and future migration;
- [x] language/timezone converge on the shared settings boundary without regression.

Detailed specification and evidence: `16_12_USER_SETTINGS_AND_PREFERENCES.md`.

---

# Block 16.13 — Notification & Delivery Router

## Status
Completed and acceptance-verified.

## Goal
Create one policy-aware router for delivery of already-authorized SG results across Telegram, Discord, Email, Web and future transports.

## Required scope
- normalized DeliveryRequest/DeliveryResult;
- recipient identity and target resource/connection references;
- immediate response vs asynchronous notification distinction;
- preferred transport/channel selection;
- explicit authorized target overrides;
- Language/Locale/Temporal integration;
- retry, timeout, deduplication and delivery status;
- configured fallback targets;
- quiet-hours/preferences where applicable;
- observability and audit.

## Boundaries
- Delivery Router does not decide semantic intent or authorize protected actions;
- delivery cannot target an unauthorized user/resource;
- transports perform protocol delivery only;
- execution success and delivery success remain distinct states.

## Acceptance criteria
- [x] results can route through multiple approved transports without core rewrites;
- [x] retries are bounded/idempotent;
- [x] failures are visible;
- [x] cross-user/resource delivery leakage tests pass.

Detailed specification and evidence: `16_13_NOTIFICATION_AND_DELIVERY_ROUTER.md`.

---

# Block 16.14 — Internal Event Bus

## Status
Completed and acceptance-verified.

## Goal
Create typed internal lifecycle events so SG modules can react without hard-wired direct coupling.

## Required scope
- versioned event envelope with id/type/time/trace/payload classification;
- synchronous and durable modes where appropriate;
- identity, connection, resource, conversation, memory, task, schedule, capability, delivery and failure events;
- subscriber isolation;
- idempotent handling;
- retry/DLQ for durable consumers;
- provenance/observability;
- payload minimization and privacy classification.

## Boundaries
- events are facts, not commands;
- Event Bus is not Decision Engine or Action Gate;
- subscribers cannot bypass protected execution paths;
- secrets/unnecessary message content are forbidden in payloads.

## Acceptance criteria
- [x] consumers can be added without rewriting producers;
- [x] duplicate events do not duplicate protected effects;
- [x] failed durable consumers are recoverable;
- [x] trace and privacy isolation are preserved;
- [x] deployment composition runs the Event Bus as a live resource and strict Observability integration is regression-tested.

Detailed specification and evidence: `16_14_INTERNAL_EVENT_BUS.md`.

---

# Block 16.15 — Schema & Contract Versioning

## Status
Completed and acceptance-verified.

## Goal
Create explicit compatibility/migration rules for durable and cross-module SG contracts.

## Required scope
- contract version fields where required;
- compatibility policy for canonical contexts, memory, tasks, capabilities, events, resources, settings and domain records;
- forward/backward compatibility rules;
- adapters/migrations;
- unsupported-version quarantine/rejection;
- deprecation lifecycle;
- version-aware diagnostics;
- old-version fixtures/tests.

## Boundaries
- database migration numbering alone is insufficient;
- silent reinterpretation of old payloads is forbidden;
- adapters cannot broaden scope, permissions or trust;
- old work replay remains subject to current safety rules.

## Acceptance criteria
- [x] critical durable contracts have explicit compatibility policy;
- [x] unsupported versions fail visibly;
- [x] migration fixtures prove supported prior versions;
- [x] queued work/events survive approved upgrades without semantic corruption;
- [x] canonical production input and capability input/result boundaries are version-checked before/after execution, with durable quarantine support where configured.

Detailed specification and evidence: `16_15_SCHEMA_AND_CONTRACT_VERSIONING.md`.

---

# Block 16.16 — Feature Flags & Controlled Rollout

## Status
Completed and acceptance-verified.

## Goal
Create centralized feature enablement, rollout cohorts and kill switches for safe incremental release.

## Required scope
- stable feature IDs;
- environment/project/role/user/resource targeting where approved;
- deterministic precedence;
- stable percentage bucketing;
- test cohorts;
- emergency disable;
- expiry/review metadata;
- audit/observability;
- Configuration & Policy integration.

## Boundaries
- flags cannot grant missing permissions, ownership or authority;
- flags cannot bypass Action Gate or safety;
- security-sensitive defaults fail closed;
- flags must not rely on secret words or user phrases.

## Acceptance criteria
- [x] new features can be limited to monarch/test cohorts/projects before broad rollout;
- [x] kill switch prevents new use without corrupting durable state;
- [x] bucketing is stable across restart;
- [x] every flag decision is diagnostically explainable;
- [x] disabled execution returns the canonical CapabilityResult contract.

Detailed specification and evidence: `16_16_FEATURE_FLAGS_AND_CONTROLLED_ROLLOUT.md`.

---

# Block 16.17 — Self Knowledge / System Self-Awareness

## Status
Planned — next mandatory block.

## Goal
Give SG a durable, structured and verifiable model of itself so it can answer what SG is, what it can do, what is implemented, what is planned and what its current limitations are without guessing from model context or re-reading the whole repository on every request.

## Required scope
- dedicated Self Knowledge storage separate from user/project memory;
- structured identity, purpose, owner, architecture, capability, module, integration, development-status and limitation facts;
- canonical statuses `implemented`, `partial`, `planned`, `disabled`, `broken`, `unknown`;
- revision-bound snapshots with provenance, source revision, Git commit SHA, environment and validation status;
- `SelfKnowledgeBuilder`;
- `SelfKnowledgeConsistencyChecker`;
- documentation/implementation/runtime mismatch detection;
- bounded retrieval for system-self-description questions;
- runtime/diagnostics verification handoff for live-state questions;
- secret-safe observability;
- prompt/user/model resistance for canonical identity, owner and architecture truth.

## Boundaries
- Self Knowledge is not ordinary memory, personality or a second reasoning engine;
- user messages and AI output cannot redefine canonical SG identity, owner or architecture truth;
- raw secrets never enter Self Knowledge;
- Self Knowledge cannot grant permissions, ownership or authority;
- roadmap text alone cannot prove implementation;
- live operational state still requires runtime evidence where applicable.

## Acceptance criteria
- [ ] dedicated Self Knowledge storage is isolated from user/project memory;
- [ ] canonical identity/purpose/owner/architecture facts are queryable;
- [ ] capabilities/modules/integrations expose one canonical status;
- [ ] snapshots are deterministic, versioned and revision-bound;
- [ ] no-op rebuild does not create duplicate state;
- [ ] roadmap-vs-code/runtime conflicts are detected and surfaced;
- [ ] planned/disabled/broken/unknown features are never claimed as working;
- [ ] self-description does not require full-repository prompt injection;
- [ ] live-state questions can invoke runtime/diagnostics verification;
- [ ] user/model injection cannot alter canonical owner/identity facts;
- [ ] restart persistence, secret-leakage and isolation tests pass.

Detailed specification: `16_17_SELF_KNOWLEDGE_SYSTEM_SELF_AWARENESS.md`.
Architecture: `../architecture/SELF_KNOWLEDGE.md`.

---

# Block 16.18 — Monarch Control / Owner Security

## Status
Planned — follows Block 16.17.

## Goal
Guarantee that only the verified SG owner/Monarch can alter SG-wide security, privileged configuration, roles/grants, owner/global identity administration and other owner-only system state.

## Required scope
- canonical owner identity rooted in `global_user_id`;
- deny-by-default owner-only Security Policy Registry;
- centralized owner Security Gateway composed with existing Action Gate;
- owner-only protection of system/security configuration, roles/grants, privileged integrations, system automation and administrative operations;
- original actor propagation and re-authorization through tasks, agents, workers, events, AI and tools;
- prompt-injection/privilege-escalation resistance by code/policy rather than model judgment;
- secret/infrastructure protection;
- privileged audit/security events, bounded rate limits and emergency `SECURITY_LOCKDOWN`;
- trusted owner recovery without conversational backdoors;
- impersonation, escalation and anti-bypass automated tests.

## Boundaries
- owner status is not inferred from username, display name, transport, command, phrase, secret word or AI output;
- owner authority tightens existing Identity/Scope/Access/Resource Authority/Action Gate controls and does not replace them;
- delegated administration never implies SG ownership;
- unknown owner/security state fails closed;
- no user, AI, agent, task, worker, tool, event consumer or domain module may broaden its own authority.

## Acceptance criteria
- [ ] exactly one canonical verified owner authority is resolved through `global_user_id`;
- [ ] non-owner actors cannot change owner-only system/security state;
- [ ] original actor identity survives deferred/indirect execution and is rechecked at execution time;
- [ ] raw secrets are non-disclosable through ordinary SG surfaces;
- [ ] privileged ALLOW/DENY decisions are auditable without secret leakage;
- [ ] lockdown and owner recovery behavior are tested;
- [ ] privilege-escalation, impersonation and bypass tests pass.

Detailed specification: `16_18_MONARCH_CONTROL_OWNER_SECURITY.md`.
Architecture: `../architecture/MONARCH_OWNER_SECURITY.md`.

---

# Block 17 — Render Deployment

## Status
Planned — follows Block 16.18.

## Goal
Deploy SG 2.1 as a controlled production environment on Render after foundational control layers, Self Knowledge and Monarch/Owner Security are implementation-verified.

## Target services

### Web service
- Telegram webhook;
- health/readiness endpoints;
- synchronous request handling;
- production runtime composition.

### Worker service
- scheduled task polling;
- durable queue processing;
- retries/DLQ;
- worker health.

### PostgreSQL
- persistent production database;
- migration execution;
- backup policy.

## Deliverables
- approved branch deployment configuration;
- environment/secret inventory using Blocks 16.7–16.8;
- build/start/migration commands;
- health checks;
- log redaction;
- rollback procedure;
- Telegram webhook registration;
- connection/credential readiness evidence;
- resource-authority readiness evidence;
- conversation/session persistence readiness evidence;
- Block 16.17 Self Knowledge readiness evidence;
- Block 16.18 owner-security readiness evidence.

## Acceptance criteria
- only approved branch is deployed;
- secrets are not exposed;
- web/worker reconnect after restart;
- migrations finish before incompatible runtime startup;
- failed deployment can be rolled back safely;
- health distinguishes process health from dependency readiness;
- owner-only system changes remain inaccessible to non-owner actors.

---

# Block 18 — End-to-End Verification

## Status
Planned.

## Goal
Prove the product through real external flows rather than only unit/contract tests.

## Required scenarios
- monarch and guest private conversation;
- group mention/reply invocation;
- two users in one group with isolated identity/language/conversation context;
- topic/thread isolation;
- multiple simultaneous conversations for one user without contamination;
- approved cross-transport conversation continuation;
- multilingual conversation and natural language switching;
- mixed-language technical input;
- linked global identity retaining approved settings across transports when available;
- resource ownership/authority checks across multiple resources/users;
- external connection available/revoked/unavailable flows;
- memory survival/retrieval after restart;
- conversation/session survival after restart;
- task creation/scheduled execution;
- protected confirmation and Action Gate denial;
- system self-description consistency and planned-vs-implemented distinction;
- live-state self-questions verified through diagnostics/runtime evidence;
- owner-only system-change denial for non-owner actors;
- original actor preservation through queued/worker/tool execution;
- owner impersonation/identity-link rejection;
- retry/DLQ/idempotency;
- duplicate Telegram update;
- temporary AI/database/Telegram outage;
- worker/restart recovery;
- delivery routing and delivery failure distinction;
- feature-flag cohort/kill-switch behavior;
- diagnostics/audit/event evidence.

## Acceptance criteria
- each scenario has reproducible evidence;
- no identity, resource, connection, settings, conversation, language, memory or Self Knowledge cross-contamination;
- protected actions remain blocked when evidence/authorization/authority is missing;
- non-owner actors cannot execute owner-only SG changes directly or indirectly;
- restart recovery works without silent work loss;
- user-visible errors are bounded and secret-safe;
- critical failures create actionable diagnostic evidence.

---

# Block 19 — Security and Operations

## Status
Planned.

## Goal
Prepare SG for controlled real-user use with operational safeguards after foundational mechanisms, Self Knowledge, owner-security controls and E2E behavior are verified.

## Deliverables
- rate limiting by identity/transport;
- webhook/endpoint hardening;
- role/grant/resource-authority/owner-security audit;
- Self Knowledge provenance/staleness/conflict operational checks;
- credential/secret scanning and redaction verification;
- data retention/export/deletion procedures;
- backup/recovery testing;
- AI cost alerts/limits;
- error/availability alerts;
- admin operations restricted appropriately;
- emergency switches for AI, automation and protected capabilities;
- feature-flag operational controls;
- owner-security lockdown/recovery operational procedure;
- incident-response runbook;
- dependency/vulnerability update process.

## Acceptance criteria
- guests cannot access monarch operations/resources;
- non-owner actors cannot alter SG-wide security/authority state;
- sensitive fields remain absent from ordinary telemetry/events;
- emergency switches work without redeployment where designed;
- backup restoration is tested;
- alerts identify actionable failure classes;
- security checks run in CI before pilot launch.

---

# Pilot Launch

## Status
Planned.

## Goal
Validate the production system with deliberately limited real-user scope.

## Initial scope
- one verified monarch/owner account;
- one private Telegram chat;
- one sandbox group;
- small test-user cohort;
- approved low-risk capabilities;
- mandatory confirmation for protected actions;
- controlled feature flags;
- Self Knowledge enabled and revision-validated;
- owner-only SG changes enforced by Block 16.18;
- close monitoring of cost, errors, resource authority, owner-security denials, delivery, conversation isolation and memory isolation.