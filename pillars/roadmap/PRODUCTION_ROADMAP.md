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
- deterministic tests and CI;
- Semantic Kernel, Context and Memory contracts;
- AI Router foundation;
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
- full Telegram transport-to-runtime-to-delivery path.

Current limitations:

- production AI execution is not validated end-to-end;
- real user-facing production capabilities are not connected;
- Render deployment is not configured for the SG 2.1 runtime;
- no complete production E2E test suite exists;
- security and operational controls for pilot launch are not complete;
- pilot users have not been enabled.

Current implementation boundary:

- Blocks 11, 12, 13 and 14 are completed.
- Block 15 is the next mandatory block and has not started.

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

Not started. This is the next mandatory block.

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

---

# Block 16 — Production Capabilities

## Goal

Implement the first real user-facing capabilities on top of the stable Capability and Domain contracts.

## Initial capability set

- conversational response;
- memory read and write;
- task creation;
- task listing and status;
- task cancellation;
- approved source retrieval;
- document intake and analysis;
- repository analysis in read or prepare-only mode;
- SG health and diagnostics report;
- controlled domain dispatch.

## Deferred high-risk capabilities

- automatic repository writes;
- automatic pull-request publication;
- real billing transfers;
- autonomous trading;
- irreversible account operations;
- any capability that broadens its own permissions.

## Acceptance criteria

- Every capability declares permissions, sources, tools, cost and action class.
- Protected capabilities cannot execute without an allowed GateDecision.
- Capabilities cannot broaden scope or grants.
- Partial and failed results remain visible.
- Real source failures do not produce fabricated success.
- Prepare-only capabilities cannot mutate external systems.

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
- No identity or memory cross-contamination occurs.
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
5. Block 15 — Production AI Integration — next, not started
6. Block 16 — Production Capabilities
7. Block 17 — Render Deployment
8. Block 18 — End-to-End Verification
9. Block 19 — Security and Operations
10. Pilot Launch

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
