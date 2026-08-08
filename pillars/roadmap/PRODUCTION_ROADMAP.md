# SG 2.1 — PRODUCTION ROADMAP

## Purpose

Turn the completed SG 2.1 platform core into a deployable, persistent and operational product without changing the approved authority order or core boundaries.

The production stage must preserve these rules:

- Connected AI models provide controlled reasoning and specialized execution; SG owns context, decisions, permissions, risk and action control.
- No direct AI calls outside AI Router.
- Protected actions always pass Action Gate.
- Identity, permissions, scope and trust order remain centralized.
- Transports provide platform facts but cannot assign roles, grants, resource ownership or final response-language policy.
- Domain modules cannot redefine Semantic Kernel, Identity, Action Gate or trust order.
- Secrets never become ordinary memory, prompt context or unrestricted telemetry.
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
- Block 16.7 — Configuration & Policy Layer.

Current executable SG therefore already has the approved Semantic Kernel, memory/context boundary, AI Router, Decision Engine, Action Gate, Capability System, global identity/scope, observability, transport abstractions, durable PostgreSQL/worker foundations, Telegram production path, production AI path, Temporal Context, multilingual Language & Locale Context, and the centralized Configuration & Policy Layer.

## Current implementation boundary

- Blocks 11–16.7 listed above are completed.
- Blocks 16.8–16.16 are planned mandatory foundational work.
- Block 16.8 is next.
- Block 17 Render Deployment follows only after completion evidence exists for Blocks 16.8–16.16.
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

---

# Foundational continuation before Render

These blocks complete core control, ownership, continuity, extensibility and rollout foundations before deployment is treated as the next mandatory stage.

Canonical dependency direction:

```text
16.7 Configuration & Policy [completed]
→ 16.8 Secrets & Credentials
→ 16.9 External Connections Registry
→ 16.10 Resource Ownership & Authority
→ 16.11 Session & Conversation Context
→ 16.12 User Settings & Preferences
→ 16.13 Notification & Delivery Router
→ 16.14 Internal Event Bus
→ 16.15 Schema & Contract Versioning
→ 16.16 Feature Flags & Controlled Rollout
→ 17 Render Deployment
```

Architecture coordination: `../architecture/FOUNDATIONAL_CONTROL_LAYERS.md`.

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
Planned — next mandatory block.

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
- production secrets are absent from repository and unrestricted telemetry;
- revoked/expired credentials fail visibly;
- credential use is auditable by purpose without exposing values;
- cross-user/project leakage tests pass.

Detailed specification: `16_8_SECRETS_AND_CREDENTIALS_MANAGEMENT.md`.

---

# Block 16.9 — External Connections Registry

## Status
Planned.

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
- a connection does not prove ownership of every provider resource;
- raw credentials are not stored in registry records;
- state changes remain gated and audited.

## Acceptance criteria
- SG can determine which services/accounts are connected and under whose authority;
- multiple accounts for one provider remain distinguishable;
- unavailable/revoked connections cannot silently execute;
- connection state survives restart and remains scope-isolated.

Detailed specification: `16_9_EXTERNAL_CONNECTIONS_REGISTRY.md`.

---

# Block 16.10 — Resource Ownership & Authority Model

## Status
Planned.

## Goal
Give SG an explicit verified model of which resources an actor/project owns, manages, administers or may act upon.

## Canonical separation

```text
Identity  = WHO is acting
Scope     = WHERE the request is bounded
Access    = WHAT action/capability is permitted
Authority = OVER WHICH RESOURCE the actor may act
```

## Required scope
- stable `resource_id` and resource type;
- platform/provider external reference;
- owner/manager/admin/read/publish/modify relations;
- actor/project/resource relationships;
- resource hierarchy where needed;
- authority provenance and verification;
- delegation and revocation;
- integration with Identity, Scope, Connections, Capabilities and Action Gate;
- audited authority changes.

## Boundaries
- membership does not prove ownership;
- adding SG to a group/channel does not grant unrestricted authority;
- authority cannot merge identities or broaden scope;
- no identity/authority secret words, commands, phrases or keyword hacks.

## Acceptance criteria
- owner/admin/manager/participant are distinguishable;
- multiple resources of one user remain independently addressable;
- different users' channels/groups/repositories cannot be confused;
- delegation is explicit, revocable and auditable;
- cross-user/resource isolation tests pass.

Detailed specification: `16_10_RESOURCE_OWNERSHIP_AND_AUTHORITY_MODEL.md`.

---

# Block 16.11 — Session & Conversation Context

## Status
Planned.

## Goal
Create a canonical model of conversations, sessions, topics and reply continuity independently from confirmed long-term memory.

## Required scope
- `conversation_id` and optional `session_id`;
- user/project/group/thread binding;
- topic and reply-chain relationships;
- start/continue/topic-shift/closure state;
- approved cross-device/cross-transport continuation;
- durable restart continuity where appropriate;
- bounded recent dialogue context;
- Language/Temporal/Context Resolver integration;
- privacy-bounded transition observability.

## Boundaries
- conversation state is not confirmed memory;
- separate conversations do not automatically merge;
- group/thread scope remains authoritative;
- transports provide reply/thread facts but do not own semantic conversation state.

## Acceptance criteria
- SG distinguishes new conversation from continuation;
- topic shifts do not corrupt unrelated context;
- two conversations for one user can coexist without contamination;
- restart and approved cross-transport continuation are deterministic.

Detailed specification: `16_11_SESSION_AND_CONVERSATION_CONTEXT.md`.

---

# Block 16.12 — User Settings & Preferences

## Status
Planned.

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
- one linked global user retains approved settings across transports;
- explicit settings deterministically override defaults/hints;
- settings survive restart and future migration;
- language/timezone converge on the shared settings boundary without regression.

Detailed specification: `16_12_USER_SETTINGS_AND_PREFERENCES.md`.

---

# Block 16.13 — Notification & Delivery Router

## Status
Planned.

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
- results can route through multiple approved transports without core rewrites;
- retries are bounded/idempotent;
- failures are visible;
- cross-user/resource delivery leakage tests pass.

Detailed specification: `16_13_NOTIFICATION_AND_DELIVERY_ROUTER.md`.

---

# Block 16.14 — Internal Event Bus

## Status
Planned.

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
- consumers can be added without rewriting producers;
- duplicate events do not duplicate protected effects;
- failed durable consumers are recoverable;
- trace and privacy isolation are preserved.

Detailed specification: `16_14_INTERNAL_EVENT_BUS.md`.

---

# Block 16.15 — Schema & Contract Versioning

## Status
Planned.

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
- critical durable contracts have explicit compatibility policy;
- unsupported versions fail visibly;
- migration fixtures prove supported prior versions;
- queued work/events survive approved upgrades without semantic corruption.

Detailed specification: `16_15_SCHEMA_AND_CONTRACT_VERSIONING.md`.

---

# Block 16.16 — Feature Flags & Controlled Rollout

## Status
Planned.

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
- new features can be limited to monarch/test cohorts/projects before broad rollout;
- kill switch prevents new use without corrupting durable state;
- bucketing is stable across restart;
- every flag decision is diagnostically explainable.

Detailed specification: `16_16_FEATURE_FLAGS_AND_CONTROLLED_ROLLOUT.md`.

---

# Block 17 — Render Deployment

## Status
Planned after Blocks 16.8–16.16.

## Goal
Deploy SG 2.1 as a controlled production environment on Render after foundational control layers are implementation-verified.

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
- connection/credential readiness evidence.

## Acceptance criteria
- only approved branch is deployed;
- secrets are not exposed;
- web/worker reconnect after restart;
- migrations finish before incompatible runtime startup;
- failed deployment can be rolled back safely;
- health distinguishes process health from dependency readiness.

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
- multilingual conversation and natural language switching;
- mixed-language technical input;
- linked global identity retaining approved settings across transports when available;
- resource ownership/authority checks across multiple resources/users;
- external connection available/revoked/unavailable flows;
- memory survival/retrieval after restart;
- task creation/scheduled execution;
- protected confirmation and Action Gate denial;
- retry/DLQ/idempotency;
- duplicate Telegram update;
- temporary AI/database/Telegram outage;
- worker/restart recovery;
- delivery routing and delivery failure distinction;
- feature-flag cohort/kill-switch behavior;
- diagnostics/audit/event evidence.

## Acceptance criteria
- each scenario has reproducible evidence;
- no identity, resource, connection, settings, conversation, language or memory cross-contamination;
- protected actions remain blocked when evidence/authorization/authority is missing;
- restart recovery works without silent work loss;
- user-visible errors are bounded and secret-safe;
- critical failures create actionable diagnostic evidence.

---

# Block 19 — Security and Operations

## Status
Planned.

## Goal
Prepare SG for controlled real-user use with operational safeguards after foundational mechanisms and E2E behavior are verified.

## Deliverables
- rate limiting by identity/transport;
- webhook/endpoint hardening;
- role/grant/resource-authority audit;
- credential/secret scanning and redaction verification;
- data retention/export/deletion procedures;
- backup/recovery testing;
- AI cost alerts/limits;
- error/availability alerts;
- admin operations restricted appropriately;
- emergency switches for AI, automation and protected capabilities;
- feature-flag operational controls;
- incident-response runbook;
- dependency/vulnerability update process.

## Acceptance criteria
- guests cannot access monarch operations/resources;
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
- one monarch account;
- one private Telegram chat;
- one sandbox group;
- small test-user cohort;
- approved low-risk capabilities;
- mandatory confirmation for protected actions;
- controlled feature flags;
- close monitoring of cost, errors, resource authority, delivery and memory isolation.
