# SG 2.2 — OpenClaw Migration Checklist

Canonical checklist for building SG 2.2 on top of a clean OpenClaw base.

Status flow: NOT STARTED → IN PROGRESS → IMPLEMENTED → VERIFIED → CLOSED

## Global integration rule

Every block starts with an OpenClaw capability audit.

1. Reuse the authoritative OpenClaw mechanism when it exists.
2. Add only SG-specific semantics that OpenClaw does not provide.
3. Extend the existing owner boundary instead of creating a parallel runtime.
4. Port SG 2.1 code only after proving that OpenClaw has no adequate equivalent.
5. Preserve OpenClaw session, routing, identity, security, tool, channel, task, memory and gateway contracts.
6. A block cannot close while a duplicate OpenClaw/SG subsystem remains.

Forbidden by default:
- second memory engine;
- second scheduler, task queue or automation executor;
- second identity, session or cross-channel linker;
- second permission engine or Action Gate;
- second Telegram/channel runtime;
- second model-provider runtime;
- second Git/GitHub development executor;
- second observability pipeline.

## Canonical order and status

1. OpenClaw foundation — IMPLEMENTED / VERIFIED
2. SG entity overlay on OpenClaw workspace — IMPLEMENTED
3. SG Identity / Global ID / roles integration with OpenClaw identity — CLOSED
3A. Telegram Test Runtime through OpenClaw — NOT STARTED
4. OpenClaw GitHub/repository access for SG — NOT STARTED
5. SG Memory 2.0 integration with OpenClaw memory — NOT STARTED
6. SG Project Memory 3.0 extension of OpenClaw memory/workspace — NOT STARTED
7. SG PDK4 integration with OpenClaw development runtime — NOT STARTED
8. SG Historical & Semantic Search extension of OpenClaw memory search — NOT STARTED
9. SG Canonical Semantic Model integration with OpenClaw dispatch — NOT STARTED
10. SG Action Gate policy binding to OpenClaw security/approvals — NOT STARTED
11. SG AI policy and cost accounting integration with OpenClaw models/providers — NOT STARTED
12. SG Tasks/Automation integration with OpenClaw automations/tasks — NOT STARTED
13. SG behavior integration with OpenClaw Telegram and future channels — NOT STARTED
14. SG Sources integration with OpenClaw web/file/browser tools — NOT STARTED
15. SG groups/users/subscriptions extension of OpenClaw channel access — NOT STARTED
16. SG observability extension of OpenClaw diagnostics/telemetry — NOT STARTED
17. Verify OpenClaw remains authoritative and no duplicate SG systems exist — NOT STARTED
18. Full SG 2.2 integration and regression test suite — NOT STARTED

## Point 1 — OpenClaw foundation

OpenClaw ownership:
- gateway, runtime, plugins, tools, sessions, channels, configuration and persistence foundation.

SG scope:
- use the clean, preserved OpenClaw baseline as the only platform foundation.

Do not:
- replace or fork foundational OpenClaw runtime behavior without a proven incompatibility.

## Point 2 — SG entity overlay

Canonical definition: `pillars/entity/SG_ENTITY.md`.

OpenClaw-native SG workspace overlay:
- `sg/workspace/IDENTITY.md`;
- `sg/workspace/SOUL.md`;
- `sg/workspace/AGENTS.md`.

OpenClaw ownership:
- agent workspace loading and instruction lifecycle.

SG scope:
- define who SG is, its mission, character and operating principles.

Point 2 intentionally does not implement identity, memory, permissions, routing or transport behavior.

## Point 3 — SG Identity / Global ID / roles integration

Status: CLOSED.

Canonical implementation and evidence:
`pillars/roadmap/SG22_IDENTITY_GLOBAL_PROFILE_INTEGRATION.md`.

OpenClaw ownership:
- sender/account identity;
- sessions and scoping;
- `session.identityLinks`;
- cross-channel canonical identity;
- pairing, allowlists and access groups.

SG scope:
- stable SG Global ID;
- persistent SG global profile;
- SG domain roles `monarch`, `citizen`, `guest`;
- SG identity fields in runtime context.

Do not:
- create a second identity, session, linking or permission system.

## Point 3A — Telegram Test Runtime through OpenClaw

Purpose:
provide an early Telegram test surface so Points 4–18 can be tested during implementation.

OpenClaw ownership:
- Telegram channel;
- gateway;
- message routing;
- channel security and delivery.

SG scope:
- deploy SG 2.2 on Render through the OpenClaw gateway;
- provision OpenClaw configuration non-interactively;
- connect the intended Telegram bot using `TELEGRAM_BOT_TOKEN`;
- configure provider credentials required for replies;
- bind Render port, health check and persistent state;
- resolve SG 2.1 webhook versus OpenClaw update-delivery mode;
- restrict test access to the intended operator;
- verify Point 3 SG identity context in a live Telegram request.

Do not:
- create a second Telegram transport, webhook runtime, router or identity path.

Exit:
- Render startup and health succeed;
- inbound Telegram message produces an outbound reply;
- SG identity context is present;
- state survives restart;
- rollback to SG 2.1 remains possible.

Point 3A does not close or replace Point 13.

## Point 4 — OpenClaw GitHub/repository access for SG

Purpose:
give SG the standard repository-development abilities already available through OpenClaw and its Codex/development tools before Memory, Project Memory and PDK4 are implemented.

OpenClaw ownership:
- Codex/development runtime;
- workspace, command, file and Git tools;
- repository discovery and normal Git operations;
- existing tool approvals, credentials and execution policy.

Implementation:
- connect the existing OpenClaw development runtime to GitHub using the credentials already available to the deployment;
- show OpenClaw the current SG repository and current SG 2.2 branch as working context;
- verify standard OpenClaw abilities to discover repositories and branches, read/search files and history, inspect diffs and CI, and perform commit/push when the user requests it and GitHub permissions allow it;
- keep repository and branch selection dynamic and controlled by the user's current task;
- use the current repository and branch as context, not as hard-coded runtime restrictions.

Do not:
- create an SG GitHub runtime, executor, capability system, Git client, credential stack or Action Gate;
- hard-code one repository or branch;
- restrict OpenClaw to the current SG repository or SG 2.2 branch;
- forbid `main` or other branches in runtime code;
- reduce standard OpenClaw repository capabilities;
- introduce special PDK4-only GitHub access.

Authority:
- the user's instruction selects the repository, branch and requested operation;
- configured GitHub permissions determine what is technically allowed;
- existing OpenClaw security and approval mechanisms remain authoritative;
- repository-specific rules belong to the task/context, not to a new SG restriction layer.

Exit:
- from the active SG interface, OpenClaw can discover and use the current SG repository and SG 2.2 branch;
- read, search, history, diff and CI inspection are verified;
- an authorized commit/push path is verified when explicitly requested;
- OpenClaw remains able to work with other permitted repositories and branches;
- no parallel SG GitHub subsystem exists.

## Point 5 — SG Memory 2.0 integration with OpenClaw memory

OpenClaw ownership:
- `USER.md`, `MEMORY.md`, daily memory;
- memory persistence and workspace files;
- `memory_search`, `memory_get`;
- active memory plugin, indexing and consolidation/dreaming.

SG scope:
- map required Memory 2.0 guarantees onto OpenClaw memory;
- add only missing SG lifecycle, isolation, confirmation or structured metadata;
- bind person-specific durable memory to `sg.globalId` where necessary.

Do not:
- port a second RecallEngine, independent memory store, indexer or search engine.

## Point 6 — SG Project Memory 3.0 extension

OpenClaw ownership:
- workspace, agent memory, sessions and project context.

SG scope:
- structured project decisions, rationale, incidents, temporal history, supersession and provenance not already represented by OpenClaw;
- keep project memory searchable through the canonical OpenClaw memory surface where possible.

Do not:
- create an unrelated parallel project-memory runtime when OpenClaw memory can own storage/search.

## Point 7 — SG PDK4 integration with OpenClaw development runtime

OpenClaw ownership:
- Codex harness and agent runtime;
- workspace/file/command/Git tools;
- development sessions and tool security.

SG scope:
- extract durable SG development knowledge from commits, diffs, pull requests, workflows and verified evidence;
- store it through the chosen canonical memory/project-knowledge owner.

Do not:
- create a second coding agent, shell runtime, Git client or development executor.

## Point 8 — SG Historical & Semantic Search extension

OpenClaw ownership:
- semantic `memory_search`;
- indexed daily and durable memory;
- memory retrieval and consolidation.

SG scope:
- add only missing historical query planning;
- timeline, first/last occurrence, lifecycle, trust, confirmation, provenance and supersession;
- reuse one canonical search/index path.

Do not:
- create a second semantic index, recall engine or disconnected search orchestrator.

## Point 9 — SG Canonical Semantic Model integration

OpenClaw ownership:
- model interpretation;
- agent turn lifecycle;
- routing, tool selection and dispatch.

SG scope:
- normalize SG requests into one Canonical Semantic Model;
- attach deterministic SG meaning once and pass it into existing OpenClaw dispatch/tool execution;
- keep behavior transport-independent.

Do not:
- build a second agent loop, router, tool dispatcher or Telegram-only semantic pipeline.

## Point 10 — SG Action Gate binding

OpenClaw ownership:
- approvals;
- sandboxing;
- tool policies;
- pairing, allowlists, access groups and security enforcement.

SG scope:
- express SG-specific risk and confirmation rules through OpenClaw approval/security mechanisms;
- map SG role/context to policy selection without making roles an authorization engine.

Do not:
- create a second Action Gate, approval store or permission engine;
- allow SG roles to bypass OpenClaw enforcement.

## Point 11 — SG AI policy and cost accounting integration

OpenClaw ownership:
- providers, models, authentication, routing, failover and runtime selection;
- provider usage data exposed by the runtime.

SG scope:
- SG quality/cost policies and profiles;
- deterministic choice constraints where required;
- normalized cost accounting, budgets and user-visible warnings when OpenClaw does not already provide them.

Do not:
- create a second provider client, model runtime, authentication store or failover stack.

## Point 12 — SG Tasks/Automation integration

OpenClaw ownership:
- persistent automations scheduler;
- one-shot, recurring, cron and event-triggered jobs;
- background tasks, run history, delivery and restart recovery;
- shared SQLite task/automation state.

SG scope:
- bind task ownership to SG Global ID;
- semantic creation, discovery, update and cancellation;
- SG role/security rules through existing OpenClaw enforcement;
- human-readable SG presentation and only missing aggregation behavior.

Do not:
- port SG Automation 2.0 as a second scheduler;
- create a second task queue, worker, executor, run ledger or cron service.

## Point 13 — SG behavior across OpenClaw channels

OpenClaw ownership:
- Telegram and other channel plugins;
- account/channel routing;
- group/DM delivery;
- pairing, allowlists and channel security;
- media and message transport.

SG scope:
- consistent SG behavior across Telegram and future interfaces;
- SG commands, buttons, files, group behavior and presentation;
- transport-independent identity, memory, semantic and security behavior.

Do not:
- create separate channel runtimes or channel-specific copies of SG core logic.

## Point 14 — SG Sources integration

OpenClaw ownership:
- web search, web fetch, browser and file tools;
- provider/plugin integrations and normalized tool boundaries.

SG scope:
- SG source registry only where a persistent catalog is required;
- trust, freshness, provenance, scheduled retrieval and user-facing source management not already provided.

Do not:
- duplicate web/file/browser clients or source-provider plugins.

## Point 15 — SG groups/users/subscriptions extension

OpenClaw ownership:
- channel groups and DMs;
- sender identity;
- pairing, allowlists, access groups and multi-account routing.

SG scope:
- SG membership/profile semantics;
- subscription lifecycle and payment state;
- expiry-driven SG access decisions expressed through OpenClaw channel access controls;
- protected owner/admin rules.

Do not:
- create a second group router, sender identity system or general access engine.

## Point 16 — SG observability extension

OpenClaw ownership:
- logs, health, diagnostics and runtime status;
- diagnostics/telemetry plugins such as OpenTelemetry or Prometheus when enabled.

SG scope:
- SG-specific identity, memory, semantic, task, cost and business events;
- connect them to OpenClaw diagnostics/telemetry;
- add only metrics or durable audit records required by SG.

Do not:
- create a disconnected logging, health or telemetry platform.

## Point 17 — Authority and duplication audit

Verify:
- OpenClaw remains authoritative at every owner boundary;
- SG additions contain only SG-specific semantics;
- no parallel identity, memory, security, task, channel, provider, GitHub or observability runtime exists;
- migrated SG 2.1 code does not override adequate OpenClaw functionality;
- obsolete duplicate paths are removed before closure.

## Point 18 — Full SG 2.2 verification

Required:
- targeted tests for every SG extension;
- relevant existing OpenClaw regression tests;
- integration tests across owner boundaries;
- Render startup/health/restart proof;
- live Telegram proof;
- identity, memory, semantic, security, automation, source and GitHub flows;
- failure and rollback verification;
- documentation/status synchronization at exact tested commit.

SG 2.2 closes only when runtime behavior, tests, documentation and checklist statuses match.
