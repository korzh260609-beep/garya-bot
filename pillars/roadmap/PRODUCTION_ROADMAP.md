# SG 2.1 — PRODUCTION ROADMAP

## Purpose

Turn the completed SG 2.1 platform core (Blocks 0–10) into a deployable, persistent and operational product without changing the approved architecture, authority order or core boundaries.

The production stage must preserve these rules:

- Connected AI models provide controlled reasoning and specialized execution; SG remains the system that owns context, decisions, permissions, risk and action control.
- No direct AI calls outside AI Router.
- Protected actions always pass Action Gate.
- Identity, permissions, scope and trust order remain centralized.
- Transports provide platform facts but cannot assign roles or grants.
- Domain modules cannot redefine Semantic Kernel, Identity, Action Gate or trust order.
- Every production action must be observable and recoverable.
- Secrets must never be stored in the repository or exposed in logs.

## Current baseline

Completed architecture and implementation:

- Blocks 0–10 platform core;
- Block 11 production runtime composition;
- Block 12 PostgreSQL persistence boundary and repositories;
- Block 13 durable automation and workers;
- Block 14 Telegram production integration;
- Block 15 production AI integration;
- Block 16 production capabilities;
- Block 16.5 Temporal Context;
- Block 16.6 Language & Locale Context;
- deterministic tests and CI;
- Semantic Kernel, Context and Memory contracts;
- AI Router foundation and production policy enforcement;
- Decision Engine and Action Gate;
- Capability System;
- Identity and Scope;
- Observability;
- transport adapters;
- Automation and Agents reference layer;
- Domain Modules platform;
- one executable runtime entrypoint with explicit dependency injection, lifecycle, health, readiness and graceful shutdown;
- PostgreSQL pool, versioned migrations, transaction boundary, durable memory adapter and scoped repositories for identity, access, conversations, automation, idempotency, observability and domain data;
- persistent PostgreSQL task queue and scheduler;
- separate worker runtime with atomic claiming, lease and heartbeat;
- abandoned-work recovery, retry with bounded exponential backoff and dead-letter queue;
- persisted approval, cancellation and idempotency;
- Action Gate immediately before protected worker execution;
- worker health and durable observability;
- Telegram webhook endpoint with secret verification;
- durable Telegram update deduplication;
- Telegram Bot API client with timeout, bounded retries and flood-control handling;
- private chat, group, supergroup and topic routing;
- explicit group addressing through reply, mention or Telegram bot-command metadata, without interpreting command names;
- arbitrary natural-language messages passed unchanged into the SG semantic runtime;
- full Telegram transport-to-runtime-to-delivery path;
- production model execution only through AI Router;
- emergency AI disable, sensitive-context rejection and role cost limits;
- structured output validation and deterministic fail-closed AI fallback;
- first real user-facing capabilities connected through the existing Capability Registry, Capability Executor, Decision Engine and Action Gate boundaries;
- canonical UTC/user-local Temporal Context with IANA timezone persistence, deterministic relative-time resolution, task normalization and temporal memory recall;
- transport-independent Language Context with per-message detection, scoped conversation continuity, durable preferred language, locale separation, AI-router fallback and privacy-bounded observability.

Current limitations:

- Render deployment is not configured for the SG 2.1 runtime;
- no complete production E2E test suite exists;
- security and operational controls for pilot launch are not complete;
- pilot users have not been enabled.

Current implementation boundary:

- Blocks 11, 12, 13, 14, 15, 16, 16.5 and 16.6 are completed.
- Block 17 is the next mandatory block.

---

# Block 11 — Runtime Composition

## Status

Completed.

## Goal

Compose Blocks 0–10 into one executable SG runtime with explicit dependency injection and one canonical request path.

## Deliverables

- production application composition root;
- validated environment configuration;
- dependency injection for all core modules;
- canonical request handler;
- response orchestration;
- startup and graceful shutdown lifecycle;
- health and readiness state;
- local deterministic production-like harness;
- fail-fast validation for missing mandatory dependencies.

## Required runtime path

`Transport Input → Transport Adapter → Identity and Scope → CanonicalInput → Context and Memory → Meaning Interpretation → Decision Engine → Action Gate → Capability/Domain Runtime → Response Plan → Transport Delivery`

## Acceptance criteria

- All core modules execute through one runtime entrypoint.
- No transport bypasses Identity, Decision Engine or Action Gate.
- No module constructs hidden global dependencies.
- Startup fails clearly when required configuration is invalid.
- Graceful shutdown stops new work and closes active resources.
- Local integration tests prove the complete request path.

---

# Block 12 — PostgreSQL Persistence

## Status

Completed.

## Goal

Replace temporary in-memory state with durable PostgreSQL repositories while preserving existing contracts.

## Deliverables

- database connection and transaction boundary;
- versioned migrations;
- repositories for users and identity links;
- roles and grants persistence;
- conversations and messages persistence;
- memory records and provenance persistence;
- task, schedule and execution state persistence;
- idempotency records;
- audit, telemetry and error-event persistence;
- domain data isolation;
- indexes and database constraints;
- backup and restore procedure.

## Acceptance criteria

- Data survives application and worker restarts.
- User, project, group and thread scope isolation is enforced.
- Identity links cannot create duplicate global identities accidentally.
- Migrations are repeatable and safe on an empty database.
- Failed transactions do not leave partial protected actions.
- Secrets and sensitive payloads are not written into unrestricted logs.

---

# Block 13 — Durable Automation and Workers

## Status

Completed.

## Goal

Convert the Block 9 reference automation engine into durable scheduled and queued execution.

## Deliverables

- persistent task queue;
- scheduler for due tasks;
- separate worker runtime;
- atomic task claiming;
- lease and heartbeat mechanism;
- retry with bounded exponential backoff;
- dead-letter queue;
- recovery of abandoned or timed-out work;
- approval and cancellation persistence;
- idempotent protected execution;
- worker health and observability.

## Acceptance criteria

- A task is not executed twice after normal retries or restarts.
- Scheduled tasks survive deployment and database restart.
- Protected automated actions always pass Action Gate immediately before execution.
- Failed work is visible and recoverable.
- Cancelled tasks cannot be claimed by workers.
- DLQ entries retain enough bounded evidence for diagnosis and replay.

---

# Block 14 — Telegram Production Integration

## Status

Completed.

## Goal

Connect the existing Telegram transport adapter to the real Telegram Bot API without moving identity, permissions or semantic interpretation into the transport.

## Deliverables

- Telegram webhook endpoint;
- webhook secret verification;
- Telegram update deduplication;
- Bot API client;
- response delivery through `sendMessage` and required Telegram methods;
- handling of private chats, groups, supergroups and topics;
- reply, mention and structured Telegram bot-command entity detection for group addressing only;
- semantic-first interaction: every non-empty private message is passed unchanged to the SG runtime;
- no command-name allowlist, keyword routing or transport-level business responses;
- optional Telegram commands treated only as platform shortcuts and never as required user interaction;
- Telegram error normalization;
- rate limits and flood-control handling;
- SG 2.0-compatible Render environment resolution;
- test sandbox configuration.

## Acceptance criteria

- Telegram IDs are treated only as platform identity facts.
- Final roles and grants come from Identity and Scope.
- Duplicate Telegram updates do not create duplicate actions.
- Group users retain separate personal contexts.
- Group and thread context remains correctly isolated.
- Users are not required to memorize commands, keywords or fixed phrases.
- Arbitrary natural-language messages reach Meaning Interpretation unchanged.
- Telegram transport does not choose intents, capabilities or business responses.
- The bot responds through the full SG runtime path.
- Telegram outages produce visible bounded failures without corrupting state.

Acceptance evidence is recorded in `14_TELEGRAM_PRODUCTION_INTEGRATION.md`.

---

# Block 15 — Production AI Integration

## Status

Completed.

## Goal

Enable controlled real-model execution through the existing AI Router.

## Deliverables

- production provider configuration;
- model registry for specialized, low-cost and reasoning models;
- structured output validation;
- timeout, retry and fallback policies;
- token and cost accounting;
- per-request reason logging;
- configurable cost thresholds;
- prompt-injection defensive boundaries;
- sensitive-context filtering;
- AI emergency disable switch;
- deterministic non-AI fallback behavior.

## Acceptance criteria

- No production model call bypasses AI Router.
- Every model call records provider, model, reason, latency, usage and estimated cost.
- Invalid model output cannot enter semantic contracts.
- AI failure does not authorize or execute an action.
- Cost limits are enforceable by role and configuration.
- Secrets are stored only in deployment secret storage.

Acceptance evidence is recorded in `15_PRODUCTION_AI_INTEGRATION.md`.

---

# Block 16 — Production Capabilities

## Status

Completed.

## Goal

Provide the first real user-facing capabilities through the existing Capability Registry, Capability Executor, Decision Engine and Action Gate boundaries without changing SG authority, identity, scope, transport or AI-routing rules.

## Implemented capability set

- `compose-answer` — conversational response;
- `memory-read` — scoped memory retrieval;
- `memory-write` — confirmed scoped memory write with provenance;
- `task-create` — task creation;
- `task-list` — scoped task listing;
- `task-status` — scoped task status;
- `task-cancel` — scoped task cancellation;
- `source-retrieve` — approved-source retrieval with visible upstream failure;
- `document-analyze` — bounded text analysis without executing embedded instructions;
- `repository-analyze` — read-only or prepare-only repository analysis;
- `sg-diagnostics` — bounded runtime diagnostics;
- `domain-dispatch` — controlled dispatch through the Domain boundary.

## Architecture

The runtime path remains:

`DecisionEnvelope → ActionRequest → ActionGate → GateDecision → CapabilityRegistry → CapabilityExecutor → CapabilityResult`

No second capability mechanism was introduced.

Capability metadata is resolved from the registered capability before Action Gate evaluation. The resulting ActionRequest carries:

- required permission;
- required sources;
- required tools;
- action class;
- risk;
- estimated cost;
- confirmation requirement.

Action Gate remains the only authorization boundary. Capability Executor still rejects execution without an allowed GateDecision and rejects requirements not covered by the gated ActionRequest.

## Safety boundaries

- capabilities cannot broaden identity, grants or scope;
- memory is isolated by user/project/group/thread scope;
- task operations are scope-bound;
- protected writes and cancellation declare confirmation requirements;
- source failures return failed or unavailable results and cannot become fabricated success;
- document content is treated as data and embedded instructions are not executed;
- repository analysis rejects any adapter result indicating mutation, push or publication;
- repository writes, commits, pushes and automatic PR publication remain deferred;
- domain dispatch fails visibly when no controlled dispatcher is configured;
- AI execution remains only through AI Router;
- transports remain delivery and platform-fact boundaries only.

## Acceptance criteria

- Every capability declares permissions, sources, tools, cost and action class.
- Protected capabilities cannot execute without an allowed GateDecision.
- Capabilities cannot broaden scope or grants.
- Partial and failed results remain visible.
- Real source failures do not produce fabricated success.
- Prepare-only capabilities cannot mutate external systems.

Acceptance evidence is recorded in `16_PRODUCTION_CAPABILITIES.md`.

---

# Block 16.5 — Temporal Context

## Status

Completed.

## Goal

Give SG one canonical, deterministic and user-aware understanding of current time, timezones, calendar dates and relative temporal expressions before production deployment and end-to-end verification.

Temporal Context is infrastructure shared by conversation, memory, recall, tasks, scheduling, automation and future transports. It must not be implemented separately inside Telegram handlers, individual capabilities or AI prompts.

## 16.5.1 — Time Foundation

- introduce one canonical clock boundary for SG runtime;
- expose current UTC instant through the Temporal service;
- derive calendar date, clock time and day-of-week from an explicit timezone;
- use injectable/fake clock support for deterministic tests;
- keep durable machine timestamps normalized to UTC unless a contract explicitly requires otherwise.

## 16.5.2 — User Timezone

- store user timezone through the existing global identity/user-settings boundary;
- use IANA timezone identifiers such as `Europe/Kyiv`, not fixed `UTC+2` or `UTC+3` offsets as the primary identity setting;
- resolve user-local time from `global_user_id` context, not Telegram-specific identity;
- support DST and historical/future offset changes through the timezone database/runtime;
- preserve explicit source/provenance for how a timezone was established or changed;
- fail visibly or request clarification when user timezone is required but genuinely unknown.

## 16.5.3 — Relative Time

SG must deterministically resolve common relative expressions against the user's local calendar and current Temporal Context, including at minimum:

- today / yesterday / day before yesterday;
- tomorrow / day after tomorrow;
- N minutes, hours, days, weeks or months from now;
- N minutes, hours, days, weeks or months ago;
- this week / next week / previous week;
- this month / next month / previous month;
- named weekdays such as next Monday;
- beginning/end of day, week, month and year where the request has sufficient meaning.

Equivalent supported-language expressions must map to the same normalized temporal contract without transport-specific keyword routing.

## 16.5.4 — Natural Temporal Expressions

Support user expressions that combine relative dates, local clock time and calendar meaning, for example:

- `tomorrow at 10:00`;
- `the day after tomorrow at 20:00`;
- `in two hours`;
- `next Monday at 14:00`;
- `next week in the evening`;
- `what did we discuss three days ago?`.

The semantic layer may interpret meaning, but deterministic temporal arithmetic and timezone conversion must be performed by the Temporal service rather than guessed by the AI model.

Ambiguous expressions must remain explicitly ambiguous. SG must not silently invent a precise timestamp when the user supplied only a broad period such as `morning`, `afternoon`, `evening` or `next week`, unless a separately approved policy defines how that broad period is represented.

## 16.5.5 — Normalized Temporal Contract

Temporal resolution must return a structured result sufficient for downstream modules. The contract must distinguish at minimum:

- original user expression;
- reference instant (`now`) used for resolution;
- timezone identifier;
- local date/time or local date range;
- normalized UTC instant or UTC range when exact enough;
- precision/granularity;
- ambiguity state;
- resolution source and confidence/evidence metadata where applicable.

A user phrase is never stored as the only scheduling truth when a normalized instant or range can be established.

## 16.5.6 — Runtime Integration

Integrate Temporal Context through existing boundaries without creating a second decision system:

- conversational answers can answer current date/time questions from Temporal Context;
- tasks and scheduler resolve user-local requested time before durable scheduling;
- memory and recall can interpret queries such as `yesterday`, `last week` and `three days ago` against the correct user-local calendar;
- automation stores durable execution instants in UTC while preserving the originating timezone and user expression when useful for audit/reconstruction;
- recurring schedules preserve intended local wall-clock semantics across DST changes where the schedule requires local-time recurrence;
- future Telegram, Discord, Web/API and other transports consume the same Temporal service through global identity context.

## 16.5.7 — Safety and Architecture Boundaries

- Temporal Context does not assign identity, roles, grants or permissions.
- Transport adapters do not own timezone or relative-time business logic.
- AI Router may assist semantic interpretation only when needed; AI does not become the source of current time or deterministic calendar arithmetic.
- No hard-coded user timezone is allowed as a universal fallback.
- Server/Render local timezone must never be treated as the user's timezone implicitly.
- System timestamps and audit records remain deterministic and auditable.
- Temporal resolution must not bypass Action Gate for state-changing actions such as task creation or schedule mutation.

## 16.5.8 — Required Tests

Automated coverage must include at minimum:

- current UTC time through an injected deterministic clock;
- at least two different user timezones for the same UTC instant;
- date boundary where users in different timezones are on different calendar days;
- today / yesterday / tomorrow;
- day before yesterday / day after tomorrow;
- `in N hours/days/weeks` and `N days/weeks ago`;
- month-end and year-end transitions;
- leap-year date handling;
- DST forward and backward transitions for a DST-observing timezone;
- recurring local-time schedule behavior across DST;
- unknown timezone behavior;
- ambiguous broad-period behavior;
- task scheduling from relative local time;
- recall date-range generation from relative expressions;
- restart persistence: scheduled UTC instant and originating timezone remain stable after process restart.

## Acceptance criteria

- SG can answer current UTC time and current user-local time without relying on AI model knowledge.
- SG can resolve today, yesterday, day before yesterday, tomorrow, day after tomorrow and relative N-unit expressions against the correct user-local calendar.
- User timezone is resolved through global identity/user settings and is transport-independent.
- DST changes do not corrupt local recurring schedule intent.
- Tasks created from relative user time execute against a deterministic normalized schedule.
- Memory/recall temporal ranges use the same Temporal service as task scheduling.
- No transport, capability or AI prompt contains a competing independent implementation of temporal arithmetic.
- Unknown or ambiguous temporal context fails visibly or remains explicitly bounded rather than being silently guessed.
- All Temporal Context tests pass in CI.

Acceptance evidence is recorded in `16_5_TEMPORAL_CONTEXT.md`.

---

# Block 16.6 — Language & Locale Context

## Status

Completed.

## Goal

Give SG one transport-independent multilingual interaction layer so users can communicate naturally in any language the connected AI model can understand, while preserving original user text, global identity, semantic-first processing and all existing authorization boundaries.

Detailed implementation and acceptance evidence are canonical in `16_6_LANGUAGE_AND_LOCALE_CONTEXT.md`.

## Implemented scope

- per-message language detection with confidence and explicit unknown state;
- deterministic high-confidence detection without model spend;
- low-confidence fallback only through AI Router when production AI is enabled;
- canonical Language Context containing message language, preferred language, conversation language, platform locale, locale, response language and provenance;
- preferred language persistence through `global_user_id` in existing PostgreSQL user profile data;
- automatic response-language selection;
- natural dynamic language switching without required commands;
- scoped conversation-language continuity by user/project/group/thread;
- mixed-language and technical-text handling;
- original text preserved for Semantic Kernel without mandatory pre-translation;
- transport-independent locale hints for Telegram, Discord, Web/API, Email, Voice and local harness;
- cross-language memory reuse through the existing ContextBundle semantic path;
- language/locale separation with Temporal Context interoperability;
- language metadata propagation through AI Router without transferring policy ownership to AI;
- language-aware response composition through AI Router;
- `language-preference-set` and `language-preference-get` capabilities through existing Capability/Action Gate boundaries;
- privacy-bounded `language_context_resolved` observability;
- PostgreSQL persistence and multilingual automated coverage.

## Architecture boundaries

- one SG Core for all languages;
- no required `/language_*` commands, keyword business routing or phrase bindings;
- transports provide hints/facts only and do not own final response-language policy;
- AI providers execute within SG-selected language context but do not own user preference or response-language decisions;
- normal input is not forcibly translated before Semantic Kernel;
- language context cannot assign identity, roles, grants or permissions;
- language context cannot bypass Decision Engine, Action Gate or Capability System;
- permanent preferred-language changes remain state-changing actions and therefore keep the existing Action Gate confirmation rule;
- language does not create separate memory identities or relax project/group/thread isolation;
- locale reuses rather than duplicates Temporal Context timezone/date/time semantics.

## Acceptance criteria

- SG communicates through the same runtime in multiple languages supported by the connected model — met.
- SG answers on the appropriate language without requiring commands — met.
- Users can switch languages naturally during a conversation — met.
- Mixed-language technical text does not cause uncontrolled switching — met.
- Preferred language follows `global_user_id` across linked transports — met at the shared identity/persistence boundary.
- Different users in one group can maintain different scoped language contexts — met.
- Memory facts remain semantically reusable across languages under existing scopes — met through ContextBundle enrichment.
- Locale is represented independently from language and interoperates with Temporal Context — met.
- Original input reaches semantic interpretation without mandatory translation — met.
- Language/locale metadata reaches AI Router only through routed calls — met.
- Language decisions are observable and bounded — met.
- Required multilingual tests, persistence checks, runtime start and worker verification pass CI — met.

Completion evidence is recorded in `16_6_LANGUAGE_AND_LOCALE_CONTEXT.md`.

---

# Block 17 — Render Deployment

## Goal

Deploy SG 2.1 as a controlled production environment on Render.

## Target services

### Web service

- Telegram webhook;
- health and readiness endpoints;
- synchronous request handling;
- production runtime composition.

### Worker service

- scheduled task polling;
- durable queue processing;
- retries and DLQ handling;
- worker health reporting.

### PostgreSQL

- persistent production database;
- migration execution;
- backup policy.

## Deliverables

- Render service definitions;
- branch-specific deployment configuration;
- environment and secret inventory;
- build and start commands;
- migration command;
- health checks;
- log redaction;
- rollback procedure;
- Telegram webhook registration procedure.

## Acceptance criteria

- Only the approved branch is deployed.
- Deployment does not expose secrets.
- Web and worker services reconnect after restart.
- Migrations complete before incompatible runtime startup.
- Failed deployment can be rolled back safely.
- Health checks distinguish process health from dependency readiness.

---

# Block 18 — End-to-End Verification

## Goal

Prove the product through real external flows rather than only unit and contract tests.

## Required scenarios

- monarch private conversation;
- guest private conversation;
- group invocation by mention;
- group invocation by reply;
- two users in one group with isolated personal context;
- group topic/thread isolation;
- Russian, Ukrainian and English natural-language conversations through the same SG runtime;
- at least one additional model-supported language through the same runtime;
- natural language switch within one conversation;
- mixed-language technical message;
- two group users communicating with SG in different languages without cross-user language contamination;
- one linked `global_user_id` retaining preferred language across two transports when those transports are available for E2E;
- memory fact written in one language and recalled in another;
- unknown/low-confidence language fallback;
- locale and Temporal Context interoperability;
- memory survival after restart;
- task creation and scheduled execution;
- confirmation before protected action;
- Action Gate denial;
- retry and DLQ behavior;
- duplicate Telegram update;
- temporary AI outage;
- temporary database outage;
- temporary Telegram API outage;
- worker restart during task execution;
- Render restart and recovery;
- diagnostics and audit evidence.

## Acceptance criteria

- Each scenario has reproducible evidence.
- No identity, language-context or memory cross-contamination occurs.
- Multilingual input follows the same Semantic Kernel/Decision/Action boundaries as other natural-language input.
- Protected actions remain blocked when evidence or authorization is missing.
- Restart recovery works without silent task loss.
- User-visible errors are clear and do not expose secrets.
- Critical failures create observable diagnostic records.

---

# Block 19 — Security and Operations

## Goal

Prepare SG for controlled use by real users with operational safeguards.

## Deliverables

- rate limiting by identity and transport;
- webhook and endpoint hardening;
- role and grant audit;
- secret scanning and log redaction;
- data retention rules;
- user data export and deletion procedure;
- database backup and recovery testing;
- AI cost alerts and limits;
- error and availability alerts;
- admin operations restricted to monarch;
- emergency switches for AI, automation and protected capabilities;
- incident-response runbook;
- dependency and vulnerability update process.

## Acceptance criteria

- Guest users cannot access monarch operations.
- Sensitive fields are absent from ordinary telemetry.
- Emergency switches work without redeployment.
- Backup restoration is tested, not merely configured.
- Operational alerts identify actionable failure classes.
- Security checks run in CI before pilot launch.

---

# Pilot Launch

## Goal

Validate the production system with a deliberately limited real-user scope.

## Initial scope

- one monarch account;
- one private Telegram chat;
- one sandbox Telegram group;
- a small set of test users;
- only approved low-risk capabilities;
- mandatory confirmation for protected actions;
- close monitoring of cost, errors and memory isolation.

## Pilot exit criteria

- stable operation across planned restarts;
- no unresolved identity or scope violations;
- no unresolved multilingual language-context isolation violations;
- no silent task loss;
- acceptable response latency;
- AI costs remain within configured limits;
- Telegram group behavior matches invocation policy;
- critical incidents have documented recovery procedures;
- monarch explicitly approves expansion beyond pilot.

---

# Mandatory implementation order

1. Block 11 — Runtime Composition — completed
2. Block 12 — PostgreSQL Persistence — completed
3. Block 13 — Durable Automation and Workers — completed
4. Block 14 — Telegram Production Integration — completed
5. Block 15 — Production AI Integration — completed
6. Block 16 — Production Capabilities — completed
7. Block 16.5 — Temporal Context — completed
8. Block 16.6 — Language & Locale Context — completed
9. Block 17 — Render Deployment — next
10. Block 18 — End-to-End Verification
11. Block 19 — Security and Operations
12. Pilot Launch

## Completion rule

A block is complete only when all of the following exist:

- implemented code and configuration;
- automated tests;
- successful `npm ci`;
- successful `npm run migrate` when the block changes durable persistence;
- successful `npm run check`;
- successful `npm start` or the block-specific runtime check;
- successful `npm run start:worker` when the block changes worker execution;
- updated documentation;
- GitHub Actions success;
- evidence that acceptance criteria are met.

A green unit-test suite alone is not sufficient evidence of production readiness.
