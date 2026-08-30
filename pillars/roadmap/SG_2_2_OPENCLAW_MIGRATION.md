# SG 2.2 — OpenClaw Migration Checklist

Canonical checklist for building and evolving the SG entity above a clean OpenClaw base.

Status flow: NOT STARTED → IN PROGRESS → IMPLEMENTED → VERIFIED → CLOSED

## Global integration rule

Project SG 2.2 is the SG entity above OpenClaw. OpenClaw remains the authoritative technical platform underneath.

Every block starts with an OpenClaw capability audit.

1. Determine what OpenClaw already provides.
2. Make the relevant native OpenClaw capability usable by the SG entity.
3. Keep the full permitted native OpenClaw capability range available to SG.
4. Add only SG-specific semantics/domain behavior that OpenClaw does not provide.
5. Port SG 2.1 code only after proving that OpenClaw has no adequate equivalent.
6. Preserve OpenClaw session, routing, identity, security, tool, channel, task, memory, provider, development and gateway contracts.
7. A block cannot close while a duplicate OpenClaw/SG subsystem remains.
8. A block cannot close if SG-specific wiring unnecessarily narrows the standard OpenClaw capability surface.

Canonical mandatory gate: `pillars/roadmap/SG22_FULL_OPENCLAW_CAPABILITY_INHERITANCE.md`.

The roadmap must always be interpreted as:

```text
What OpenClaw already provides
        ↓
SG entity can use it
        ↓
Add only missing SG-specific semantics
```

Never as:

```text
Take SG 2.1 subsystem
        ↓
port/rebuild it beside OpenClaw
```

Points 5–16 are therefore primarily **OpenClaw capability audit + SG semantic/domain overlay**, not projects to recreate SG 2.1 subsystems.

Forbidden by default:
- second memory engine;
- second scheduler, task queue or automation executor;
- second identity, session or cross-channel linker;
- second permission engine or Action Gate;
- second Telegram/channel runtime;
- second model-provider runtime;
- second Git/GitHub development executor;
- second observability pipeline;
- separate SG capability whitelist that exposes only selected OpenClaw functions.

## Full OpenClaw capability inheritance

The SG entity must be able to use every standard OpenClaw capability available and permitted in the active environment, including capabilities not explicitly named in this roadmap and capabilities added by future OpenClaw versions.

A native OpenClaw capability may be unavailable to SG only because of a real underlying boundary:
- credentials or permissions;
- OpenClaw security/approval/sandboxing/pairing/access policy;
- deployment/platform limitation;
- missing installation/configuration;
- technical unavailability;
- explicit owner restriction.

SG-specific code must not silently reduce, shadow, replace, fork or disable otherwise available OpenClaw capabilities.

## Canonical order and status

1. OpenClaw foundation — IMPLEMENTED / VERIFIED
2. SG entity above OpenClaw workspace — IMPLEMENTED
3. SG Identity / Global ID / roles semantics above OpenClaw identity — CLOSED
3A. Telegram Test Runtime through OpenClaw — NOT STARTED
4. Full OpenClaw GitHub/repository capability availability to SG — NOT STARTED
5. SG Memory 2.0 semantics above OpenClaw memory — NOT STARTED
6. SG Project Memory 3.0 semantics above OpenClaw memory/workspace — NOT STARTED
7. SG PDK4 semantics above OpenClaw development runtime — NOT STARTED
8. SG Historical & Semantic Search semantics above OpenClaw memory search — NOT STARTED
9. SG Canonical Semantic Model above OpenClaw dispatch — NOT STARTED
10. SG risk/confirmation policy through OpenClaw security/approvals — NOT STARTED
11. SG AI quality/cost policy above OpenClaw models/providers — NOT STARTED
12. SG task semantics above OpenClaw tasks/automations — NOT STARTED
13. SG entity behavior across all permitted OpenClaw channels — NOT STARTED
14. SG source semantics above OpenClaw web/file/browser tools — NOT STARTED
15. SG groups/users/subscriptions semantics above OpenClaw channel access — NOT STARTED
16. SG observability semantics above OpenClaw diagnostics/telemetry — NOT STARTED
17. Verify OpenClaw remains authoritative, no duplicate SG systems exist, and SG retains full permitted OpenClaw capability access — NOT STARTED
18. Full SG 2.2 integration, OpenClaw capability-inheritance and regression verification — NOT STARTED

## Point 1 — OpenClaw foundation

OpenClaw ownership:
- gateway, runtime, agents, plugins, skills, tools, sessions, channels, configuration and persistence foundation.

SG scope:
- use the clean, preserved OpenClaw baseline as the technical platform underneath the SG entity;
- preserve OpenClaw capability availability for the SG entity.

Do not:
- replace or fork foundational OpenClaw runtime behavior without a proven incompatibility.

## Point 2 — SG entity above OpenClaw

Canonical definition: `pillars/entity/SG_ENTITY.md`.

OpenClaw-native SG workspace overlay:
- `sg/workspace/IDENTITY.md`;
- `sg/workspace/SOUL.md`;
- `sg/workspace/AGENTS.md`.

OpenClaw ownership:
- agent workspace loading and instruction lifecycle.

SG scope:
- create the SG entity above OpenClaw;
- define who SG is, its mission, character and operating principles.

Project SG begins with this entity above OpenClaw. OpenClaw itself is not converted into SG.

## Point 3 — SG Identity / Global ID / roles semantics

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
provide an early Telegram test surface through the standard OpenClaw Telegram capability so later points can be tested during implementation.

OpenClaw ownership:
- Telegram channel;
- gateway;
- message routing;
- channel security and delivery.

SG scope:
- deploy the SG entity through the OpenClaw gateway;
- connect the intended Telegram bot using native OpenClaw configuration;
- configure provider credentials required for replies;
- bind Render port, health check and persistent state;
- resolve SG 2.1 webhook versus OpenClaw update-delivery mode;
- restrict test access to the intended operator through OpenClaw mechanisms;
- verify SG identity context in a live Telegram request.

Do not:
- create a second Telegram transport, webhook runtime, router or identity path.

Exit:
- Render startup and health succeed;
- inbound Telegram message produces an outbound SG reply through OpenClaw;
- SG identity context is present;
- state survives restart;
- rollback remains possible.

## Point 4 — Full OpenClaw GitHub/repository capability availability to SG

Purpose:
make the complete permitted OpenClaw development/Git/GitHub capability surface usable by the SG entity before Memory, Project Memory and PDK4 work.

OpenClaw ownership:
- Codex/development runtime;
- workspace, shell, command, file and Git tools;
- repository discovery and normal Git operations;
- existing tool approvals, credentials and execution policy.

Implementation:
- connect the existing OpenClaw development runtime to GitHub using available credentials;
- expose the current SG repository/branch as working context, not as a restriction;
- verify repository discovery, branch discovery, read/search, history, diff, CI and authorized commit/push;
- keep repository and branch selection dynamic and task-controlled;
- retain standard OpenClaw ability to work with other permitted repositories and branches.

Do not:
- create an SG GitHub runtime, executor, capability system, Git client, credential stack or Action Gate;
- hard-code one repository or branch;
- reduce standard OpenClaw repository capabilities;
- introduce special PDK4-only GitHub access.

Exit:
- SG can use the full permitted native OpenClaw development capability surface;
- no parallel SG GitHub subsystem exists.

## Point 5 — SG Memory 2.0 semantics above OpenClaw memory

Default work type: **OpenClaw audit + SG semantic overlay**.

OpenClaw ownership:
- memory persistence and workspace files;
- memory search/retrieval;
- active memory plugin, indexing and consolidation/dreaming where configured.

SG scope:
- map required Memory 2.0 guarantees onto OpenClaw memory;
- add only missing SG lifecycle, isolation, confirmation or structured metadata;
- bind durable person-specific SG semantics to `sg.globalId` where necessary.

Do not:
- port Memory 2.0 as a second memory platform, RecallEngine, independent indexer or search engine.

## Point 6 — SG Project Memory 3.0 semantics above OpenClaw memory/workspace

Default work type: **OpenClaw audit + SG semantic overlay**.

OpenClaw ownership:
- workspace, agent memory, sessions and project context.

SG scope:
- add only project decisions, rationale, incidents, temporal history, supersession and provenance semantics missing from OpenClaw;
- keep project knowledge reachable through canonical OpenClaw memory/workspace surfaces where possible.

Do not:
- create a parallel Project Memory platform.

## Point 7 — SG PDK4 semantics above OpenClaw development runtime

Default work type: **OpenClaw audit + SG semantic overlay**.

OpenClaw ownership:
- Codex/development harness and agent runtime;
- workspace/file/command/Git/GitHub tools;
- development sessions and tool security.

SG scope:
- add durable SG development-knowledge semantics from commits, diffs, pull requests, workflows and verified evidence;
- store them through the chosen canonical OpenClaw-backed memory/project-knowledge path.

Do not:
- create a second coding agent, shell runtime, Git client or development executor.

## Point 8 — SG Historical & Semantic Search semantics above OpenClaw memory search

Default work type: **OpenClaw audit + SG semantic overlay**.

OpenClaw ownership:
- semantic memory search;
- indexed durable/daily memory;
- retrieval and consolidation.

SG scope:
- add only missing historical query planning, timeline, first/last occurrence, lifecycle, trust, confirmation, provenance and supersession semantics.

Do not:
- create a second semantic index, recall engine or disconnected search orchestrator.

## Point 9 — SG Canonical Semantic Model above OpenClaw dispatch

Default work type: **OpenClaw audit + SG semantic overlay**.

OpenClaw ownership:
- model interpretation;
- agent turn lifecycle;
- routing, tool selection and dispatch.

SG scope:
- add SG canonical semantic normalization without replacing the OpenClaw agent/dispatch lifecycle;
- keep behavior transport-independent.

Do not:
- build a second agent loop, router or tool dispatcher.

## Point 10 — SG risk/confirmation policy through OpenClaw security/approvals

Default work type: **OpenClaw audit + SG policy overlay**.

OpenClaw ownership:
- approvals;
- sandboxing;
- tool policies;
- pairing, allowlists, access groups and security enforcement.

SG scope:
- express only SG-specific risk/confirmation semantics through native OpenClaw enforcement.

Do not:
- create a second Action Gate, approval store or permission engine.

## Point 11 — SG AI quality/cost policy above OpenClaw models/providers

Default work type: **OpenClaw audit + SG policy overlay**.

OpenClaw ownership:
- providers, models, authentication, routing, failover and runtime selection.

SG scope:
- add only SG quality/cost policy, budgets, accounting and warnings not adequately provided by OpenClaw.

Do not:
- create a second provider client, model runtime, authentication store or failover stack.

## Point 12 — SG task semantics above OpenClaw tasks/automations

Default work type: **OpenClaw audit + SG semantic overlay**.

OpenClaw ownership:
- persistent tasks/automations;
- one-shot, recurring, cron and event-triggered jobs;
- background execution, run history, delivery and restart recovery.

SG scope:
- add SG Global ID ownership, semantic creation/discovery/update/cancellation, presentation and only missing aggregation/business semantics.

Do not:
- port SG Automation 2.0 as a second scheduler/task queue/worker/executor.

## Point 13 — SG entity behavior across all permitted OpenClaw channels

Default work type: **OpenClaw audit + SG behavior overlay**.

OpenClaw ownership:
- Telegram and all other channel plugins;
- account/channel routing;
- group/DM delivery;
- pairing, allowlists and channel security;
- media/message transport.

SG scope:
- make the same SG entity and semantics work through every permitted OpenClaw channel;
- preserve future channel inheritance without creating channel-specific SG runtimes.

Do not:
- create separate SG transport runtimes.

## Point 14 — SG source semantics above OpenClaw web/file/browser tools

Default work type: **OpenClaw audit + SG semantic overlay**.

OpenClaw ownership:
- web search/fetch, browser, file and provider/plugin tools.

SG scope:
- add only persistent SG source catalog/trust/freshness/provenance/scheduled retrieval semantics that are actually missing.

Do not:
- duplicate web/file/browser clients or provider plugins.

## Point 15 — SG groups/users/subscriptions semantics above OpenClaw channel access

Canonical staged plugin plan:
`pillars/roadmap/SG22_WORKSPACE_COMMUNITY_PLUGIN.md`.

Default work type: **OpenClaw audit + SG business-semantic overlay**.

OpenClaw ownership:
- channel groups/DMs;
- sender identity;
- pairing, allowlists, access groups and multi-account routing.

SG scope:
- add SG membership/profile/subscription/payment/expiry business semantics;
- express access consequences through native OpenClaw access mechanisms.

Do not:
- create a second group router, sender identity system or general access engine.

## Point 16 — SG observability semantics above OpenClaw diagnostics/telemetry

Default work type: **OpenClaw audit + SG observability overlay**.

OpenClaw ownership:
- logs, health, diagnostics and runtime status;
- diagnostics/telemetry integrations when enabled.

SG scope:
- add only SG-specific identity, memory, semantic, task, cost and business events/metrics/audit records required above OpenClaw.

Do not:
- create a disconnected observability platform.

## Point 17 — Authority, duplication and capability-inheritance audit

Verify:
- OpenClaw remains authoritative at every platform owner boundary;
- SG additions contain only SG-specific semantics/domain behavior;
- no parallel identity, memory, security, task, channel, provider, GitHub or observability runtime exists;
- migrated SG 2.1 code does not override adequate OpenClaw functionality;
- obsolete duplicate paths are removed;
- **SG can still use the full standard OpenClaw capability surface permitted in the active environment**;
- no SG-specific whitelist or wiring artificially narrows OpenClaw;
- future standard OpenClaw capabilities can flow to SG without requiring a new parallel SG runtime.

## Point 18 — Full SG 2.2 verification

Required:
- targeted tests for every SG-specific extension;
- relevant existing OpenClaw regression tests;
- integration tests across owner boundaries;
- proof that SG can use the permitted native OpenClaw capability surface;
- Render startup/health/restart proof;
- live Telegram proof;
- identity, memory, semantic, security, automation, source and GitHub flows;
- representative agents/tools/skills/plugins/channels/browser/files/shell/development capability checks where available;
- failure and rollback verification;
- documentation/status synchronization at exact tested commit.

SG 2.2 closes only when runtime behavior, tests, documentation, full permitted OpenClaw capability inheritance and checklist statuses match.
