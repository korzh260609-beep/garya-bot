# SG 2.2 — Workspace Community Plugin Roadmap

## Status

IN PROGRESS — WSP1 CLOSED

This document is the canonical implementation plan for the external SG workspace/community plugin above OpenClaw.

Working name: `SG Workspace Manager`.

The plugin carries forward only SG-specific group, channel, community and workspace semantics that are missing from OpenClaw. It must not recreate the SG 2.1 Telegram Workspace Manager as a parallel Telegram runtime.

## Purpose

Turn each permitted group, channel, room or topic into an isolated SG-managed workspace while preserving OpenClaw as the authoritative platform for transport, sender identity, sessions, routing, security, tools, messages, media and automation.

Target relationship:

```text
Telegram / Discord / other OpenClaw channels
        ↓
native OpenClaw channel adapter
        ↓
OpenClaw sender identity, session, routing and access
        ↓
SG Workspace Manager external plugin
        ↓
SG workspace business state
        ↓
native OpenClaw tools, approvals and automations
```

## Non-negotiable boundaries

The plugin must not:

- modify OpenClaw core;
- modify or fork the standard Telegram adapter;
- create a second channel transport, webhook, polling loop or message router;
- create a second sender identity, session identity or cross-channel linker;
- create a second general permission engine, approval system or Action Gate;
- create a second scheduler, task queue or automation executor;
- send Telegram requests through a parallel Bot API client when an adequate OpenClaw action exists;
- hard-code one group, channel, transport, repository or owner;
- write SG profiles from a blocking inbound hook;
- silently reduce the standard OpenClaw capability surface;
- port SG 2.1 code before proving that OpenClaw has no adequate equivalent.

Every function must follow:

```text
audit native OpenClaw capability
        ↓
reuse the native capability
        ↓
add only missing SG business semantics
        ↓
verify full reply/action path
```

## Responsibility split

### OpenClaw remains authoritative for

- channel accounts and adapters;
- incoming and outgoing messages;
- group, channel, room and topic routing;
- sender/account identity and `session.identityLinks`;
- session scoping and conversation history;
- pairing, allowlists, access groups and tool policy;
- media, buttons, reactions, edits, deletes and native channel actions;
- tasks, schedules and automations;
- approvals, sandboxing and security enforcement;
- logs, health and base diagnostics.

### SG Workspace Manager owns only

- SG workspace registration and durable business metadata;
- binding a workspace to an SG Global ID;
- SG project roles `monarch`, `citizen`, `guest`;
- workspace roles `owner`, `admin`, `member`;
- SG membership and registration business state;
- content drafts, editorial state and publication records;
- multi-step tests and deterministic result state;
- FAQ, onboarding, feedback and unanswered-question state;
- moderation cases, warnings and SG policy decisions;
- workspace analytics snapshots and SG audit records.

## Identity and role model

The plugin consumes the canonical identity supplied by OpenClaw and resolves it through the existing SG Global Profile integration.

Required chain:

```text
OpenClaw channel sender
        ↓
OpenClaw canonical identity
        ↓
existing SG Global ID binding
        ↓
SG project role
        ↓
workspace-specific role
```

SG project roles:

- `monarch` — owner of SG and registration authority during development;
- `citizen` — registered SG user allowed to use SG capabilities;
- `guest` — unknown or unregistered user; no SG project capabilities.

Workspace roles:

- `owner` — owner of one concrete workspace;
- `admin` — delegated manager of that workspace;
- `member` — ordinary participant.

Project role and workspace role are independent. A citizen may own workspace A, administer workspace B and be a member of workspace C.

OpenClaw access denial always wins. SG roles cannot bypass OpenClaw security or channel permissions.

## Canonical workspace model

A workspace represents one managed resource on any supported channel.

Minimum fields:

- `workspaceId` — stable SG identifier;
- `platform` — canonical OpenClaw channel ID;
- `accountId` — OpenClaw channel account when applicable;
- `resourceKind` — `group | channel | room | topic`;
- `resourceId` — transport resource ID received from OpenClaw;
- `parentResourceId` — parent group/channel for a topic when applicable;
- `title`;
- `ownerGlobalId`;
- `status` — `pending | active | suspended | archived`;
- `settings`;
- `createdAt`;
- `updatedAt`.

The unique platform key is the normalized combination of platform, account, resource and topic identifiers. Data from different workspaces must never mix.

## Plugin modules

One external plugin may contain internal modules, but they must share one identity, authority, persistence and audit boundary.

1. `identity-context` — consumes OpenClaw identity and resolves existing SG Global ID/profile.
2. `workspace-registry` — registers and resolves groups, channels, rooms and topics.
3. `workspace-authority` — evaluates SG and workspace roles plus native channel evidence.
4. `membership` — citizen requests, approvals and workspace membership business state.
5. `content` — drafts, editorial status, publication records and scheduling metadata.
6. `polls-tests` — multi-step tests, attempts and deterministic results.
7. `community` — FAQ, onboarding, feedback, submissions and unanswered questions.
8. `moderation` — warnings, cases, proposals and confirmed actions.
9. `analytics` — deterministic metrics, snapshots and optional AI interpretation.
10. `audit` — actor, workspace, operation, before/after state, result and rollback metadata.

## Implementation stages

Status flow for every stage:

`NOT STARTED → IN PROGRESS → IMPLEMENTED → VERIFIED → CLOSED`

### WSP1 — OpenClaw plugin seam and safe context proof

Status: `CLOSED`

Goal: prove the external integration point before implementing business functions.

Work:

- create a standard external OpenClaw plugin package and manifest;
- register only read-only diagnostic capability at first;
- receive canonical requester, channel, account, conversation/resource and topic context;
- resolve the existing SG Global ID and SG project role without writing during the blocking hook;
- return a diagnostic result through the normal OpenClaw reply path;
- add no Telegram-specific transport code.

Exit:

- the same plugin path works in DM and group;
- a complete inbound → plugin → normal outbound reply is proven;
- unknown identity resolves fail-closed to `guest`;
- working Telegram behavior remains unchanged when the plugin is disabled;
- no OpenClaw core or standard channel adapter changes exist.

Implemented WSP1 scope:

- external plugin manifest and package: `sg/plugin` (`sg-workspace-manager`);
- one read-only diagnostic command: `/sg_context`;
- canonical sender resolution consumes OpenClaw `channel`, `senderId` and `session.identityLinks`;
- existing `global-profiles.json` is read without creating or updating profiles;
- missing, inactive or unknown identity fails closed to `guest`;
- OpenClaw command context supplies account, resource and topic identifiers;
- `SG_WORKSPACE_PLUGIN_ENABLED=false` disables the plugin without changing Telegram or ordinary OpenClaw replies.

Local proof completed:

- monarch direct context;
- monarch group/topic context;
- citizen and unknown guest resolution;
- byte-for-byte and mtime proof that the profile store is unchanged;
- simulated restart with stable result;
- Plugin API command registration and normal reply payload;
- disabled-plugin no-registration path;
- manifest JSON and Render entrypoint shell syntax.

Live verification completed:

- exact-head image build succeeded;
- manual Render deploy succeeded with autodeploy still off;
- monarch DM and group returned the same existing Global ID and `monarch` role;
- unknown user returned their existing Global ID and fail-closed `guest` role;
- restart preserved both identities and roles;
- disabling the plugin removed it from the OpenClaw runtime while ordinary SG replies continued;
- re-enabling the plugin restored `/sg_context` through the normal OpenClaw reply path;
- no OpenClaw core or Telegram adapter files changed.

### WSP2 — Workspace registry and isolation

Status: `IMPLEMENTED` — local registry and normal reply-path proof passed; live verification pending.

Goal: represent every managed resource independently.

Work:

- define the canonical workspace contract;
- register, resolve, suspend and archive workspaces;
- bind resource identity to `workspaceId`;
- persist workspace metadata;
- isolate all reads/writes by `workspaceId`;
- support at least groups, channels and forum topics without hard-coded IDs.

Exit:

- two different groups and one channel resolve to different workspaces;
- no state crosses workspace boundaries;
- restart preserves registry state;
- unregistered resources fail safely without breaking normal OpenClaw chat.

Implemented WSP2 scope:

- canonical cross-channel workspace contract and stable normalized resource key;
- SG-owned atomic registry at `<OPENCLAW_STATE_DIR>/sg/workspaces.json`;
- OpenClaw SDK atomic JSON writes plus fail-closed file locking;
- idempotent registration, resource resolution, suspend and archive state;
- separate workspaces for groups, channels and forum topics;
- read-only `/sg_workspace` command through the normal OpenClaw reply path;
- no automatic registration or platform-role inference before WSP3.

Persistence decision:

- OpenClaw SQLite plugin state was audited first;
- this OpenClaw release exposes `openKeyedStore` only to bundled or trusted official plugins and rejects an ordinary external workspace plugin;
- the external SG plugin therefore uses the supported plugin SDK JSON and locking helpers without adding a database, session store or parallel runtime;
- migration to native keyed plugin state remains possible if OpenClaw later permits it for this external plugin.

Local proof completed:

- two groups and one channel remain isolated;
- a forum topic remains isolated from its parent group;
- duplicate normalized registration is idempotent;
- concurrent registrations do not lose state;
- suspend and archive survive a simulated restart;
- an unknown resource returns an explicit unregistered result;
- an invalid registry fails closed instead of being overwritten;
- WSP1 and WSP2 targeted tests pass together.

### WSP3 — Workspace authority

Status: `IMPLEMENTED` — internal onboarding and monarch-confirmed owner assignment pass local tests; live verification pending.

Goal: establish the exact user role for a concrete workspace.

Work:

- keep SG project roles separate from workspace roles;
- consume native OpenClaw access/security outcome first;
- obtain platform authority evidence only through supported channel/plugin capabilities;
- map verified owner/admin/member evidence into workspace business roles;
- support monarch confirmation when platform ownership cannot be proven;
- record source, timestamp and freshness of authority evidence;
- prevent stale authority from silently authorizing protected actions.

Exit:

- monarch, citizen and guest are distinguished in DM and workspace context;
- owner, admin and member are distinguished per workspace;
- the same person may have different roles in different workspaces;
- OpenClaw denial cannot be overridden;
- protected operations fail closed when authority evidence is missing or stale.

Implemented WSP3 onboarding scope:

- SG receives static agent guidance to discover an unregistered group, channel, room or topic itself;
- users do not need to know the term `workspace` or any registration command;
- internal `sg_workspace_onboard` creates an idempotent pending request from trusted current-route context;
- the person who adds or first invokes SG is recorded only as the initiator and is never assigned as owner automatically;
- internal pending-list and decision tools are protected by the existing active SG `monarch` profile;
- approval requires a separately identified active owner Global ID;
- monarch confirmation is recorded as the authority source before WSP2 creates the active workspace;
- rejection leaves the resource unregistered;
- pending requests persist atomically at `<OPENCLAW_STATE_DIR>/sg/workspace-requests.json` using the same SDK locking and JSON helpers as WSP2;
- no public technical registration command, Telegram API client, transport, identity store, session store or general approval system was added.

Current platform-evidence boundary:

- this OpenClaw release does not expose Telegram `getChatMember` or `getChatAdministrators` through its generic channel-action surface to an external plugin;
- therefore the initiator cannot be treated as the resource owner from the add event alone;
- owner assignment remains fail-closed and requires monarch confirmation until OpenClaw exposes supported platform-authority evidence.

Local proof completed:

- repeated discovery of the same resource produces one request;
- initiator and owner remain distinct fields;
- a missing or inactive owner profile cannot activate a workspace;
- monarch approval activates WSP2 with the confirmed owner Global ID;
- rejection creates no workspace;
- ordinary commands and the normal OpenClaw reply path remain registered unchanged.

### WSP4 — Citizen and membership workflow

Goal: add SG registration and workspace participation business semantics.

Work:

- create a citizen registration request;
- allow the monarch to approve or reject during development;
- keep guests without SG capability access;
- store workspace membership status;
- process join/leave/rejoin events when the channel exposes them;
- add manual grant/revoke with audit;
- reuse OpenClaw access mechanisms for enforcement consequences.

Deferred:

- paid plans;
- invoices;
- renewals;
- refunds;
- automatic payment enforcement.

Exit:

- each user is handled independently by Global ID;
- approval survives restart;
- a guest cannot gain citizen capabilities by joining a group;
- membership changes do not alter unrelated workspaces.

### WSP5 — Content and publication

Goal: restore SG-specific editorial workflow without a second publisher or scheduler.

Work:

- drafts for text and supported media references;
- editorial statuses and approval;
- publish now through native OpenClaw message actions;
- schedule, cancel and reschedule through native OpenClaw automations;
- durable publication history and delivery result;
- explicit destination workspace and topic;
- confirmation for protected or high-impact publication.

Exit:

- text and representative media publish through OpenClaw;
- scheduled delivery survives restart;
- cancellation prevents delivery;
- delivery cannot escape the selected workspace;
- no parallel Telegram Bot API client or SG scheduler exists.

### WSP6 — Polls, quizzes and multi-step tests

Goal: restore test semantics not adequately provided by native channel actions.

Work:

- audit native poll support for each active channel;
- use native polls where adequate;
- use native OpenClaw buttons/interactions for multi-step tests;
- support knowledge tests and profile-style tests;
- store questions, attempts, answers and completion state by Global ID and workspace;
- compute scores and statistics deterministically;
- deliver private results without closing the shared test for other participants;
- keep AI interpretation non-authoritative.

Exit:

- two users can complete the same test independently;
- an admin completion does not close another user's attempt;
- restart does not corrupt active attempts;
- exact results are reproducible from stored answers;
- privacy rules prevent leaking individual results.

### WSP7 — Community and moderation

Goal: restore workspace-scoped community operations.

Work:

- approved FAQ;
- onboarding steps;
- feedback and idea submissions;
- unanswered-question tracking;
- moderation warnings and cases;
- proposed moderation actions;
- confirmation and authority check before protected actions;
- execute only through native OpenClaw/channel actions when available;
- maintain reversible state and audit where possible.

Exit:

- FAQ and onboarding are isolated per workspace;
- moderation cannot act without fresh authority;
- automatic irreversible moderation is disabled until an explicit policy is approved;
- every attempted action records actor, reason and result;
- failure of a native channel action does not produce false success.

### WSP8 — Analytics, audit and operational verification

Goal: provide exact workspace reporting and complete proof.

Work:

- count messages/events only from available authoritative inputs;
- compute active participants, publications, poll/test outcomes, unanswered items and moderation events;
- create daily/weekly snapshots;
- allow optional AI narrative only above immutable exact metrics;
- provide audit search and rollback metadata;
- use OpenClaw diagnostics and add only SG-specific events;
- verify plugin disable/rollback behavior.

Exit:

- deterministic metrics match source records;
- AI output cannot modify authoritative numbers;
- reports remain workspace-isolated;
- no disconnected observability pipeline exists;
- exact tested commit, tests, deployment and live evidence are recorded.

## Proposed persistence

The final schema must be selected only after auditing current OpenClaw plugin-state and existing SG Global Profile persistence.

Expected SG-owned entities:

- workspaces;
- workspace role assignments and authority evidence;
- citizen registration requests;
- workspace membership records;
- content drafts and publication records;
- tests, questions, attempts and answers;
- FAQ, onboarding and submissions;
- moderation cases and warnings;
- analytics snapshots;
- audit events.

Do not duplicate OpenClaw sessions, channel messages, allowlists, access groups, tasks or automation execution state.

## Required verification matrix

Before closure, test at minimum:

- DM: monarch, citizen, guest;
- group A: owner, admin, member, guest;
- group B: the same users with different roles;
- one channel;
- one forum topic when supported;
- restart and persistent-state recovery;
- plugin disabled;
- missing/stale authority evidence;
- native action failure;
- unauthorized and cross-workspace access attempts;
- OpenClaw regression tests relevant to plugin/channel seams;
- full inbound request and visible outbound reply.

Live deployment is not proof of correctness by itself. A stage must first pass targeted tests at the exact commit.

## Rollback rule

Every implementation stage must:

- begin from a recorded working commit;
- remain removable by disabling the external plugin;
- avoid data-destructive migrations until a backup and rollback path are proven;
- preserve the current working OpenClaw Telegram path;
- document any irreversible external action before enabling it.

## Implementation order

The mandatory order is:

```text
WSP1 plugin/context proof
  → WSP2 workspace registry
  → WSP3 authority
  → WSP4 citizen/membership
  → WSP5 content
  → WSP6 polls/tests
  → WSP7 community/moderation
  → WSP8 analytics/audit/verification
```

Do not start content, tests or moderation until WSP1–WSP3 are VERIFIED. This prevents feature state from being built above an unproven identity/authority chain.

## Definition of success

The plugin is successful only when:

- OpenClaw remains clean and authoritative;
- the standard Telegram adapter is unchanged;
- the same SG Global ID and roles work through all supported channels;
- different groups/channels remain isolated and have correct owners/admins;
- SG-specific content, tests, membership, community, moderation and analytics work through native OpenClaw capabilities;
- disabling the plugin restores plain OpenClaw behavior;
- no duplicate identity, transport, scheduler, permission or observability system exists.
