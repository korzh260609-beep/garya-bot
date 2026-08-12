# SG 2.1 — TELEGRAM WORKSPACE MANAGER 1.0

## Status
**IN PROGRESS — TWM1.1–TWM1.5 CLOSED / TWM1.6 NEXT.**

Telegram Workspace Manager 1.0 (TWM1) is a cross-cutting SG module that lets any authorized SG user connect, configure and operate SG inside Telegram groups, supergroups and channels without programming.

TWM1 is not a new Telegram transport, not a second identity system, not a second access-control system and not an AI-owned configuration surface. It reuses the existing SG runtime boundaries.

## Goal
A user must be able to:

```text
open SG in Telegram
→ discover or connect a group/channel
→ prove current authority over that Telegram resource
→ see SG's actual bot permissions
→ configure behavior through native Telegram UI or natural language
→ create/publish/schedule workspace content where authorized
→ create polls/quizzes/tests and attach or publish supplied media
→ collect structured result events
→ compute deterministic statistics
→ optionally receive AI Router analysis of those computed results
→ preview/confirm protected changes/actions
→ persist configuration/state per workspace
→ have runtime behavior change accordingly
→ audit and rollback configuration changes
```

No user should need to edit code, `.env`, JSON, webhook configuration or database rows.

## Canonical relationship

```text
Telegram Transport
  → Identity & Scope
  → Telegram Workspace Resolver
  → Resource Authority
  → Workspace Services
      ├─ Workspace Configuration Service
      ├─ Workspace Content Service
      ├─ Poll / Quiz / Test Manager
      ├─ Workspace Media Manager
      └─ Workspace Statistics Engine
  → Decision / Action Gate
  → PostgreSQL / Durable Automation where required
  → Telegram Runtime
```

Natural-language control adds only:

```text
user text
→ Semantic/Intent resolution
→ AI Router when needed
→ structured Configuration/Content Proposal
```

AI/model output is proposal or analysis data only. It never writes configuration/content state directly, never grants authority and never becomes the numeric source of poll/test statistics.

## Telegram Workspace
A `TelegramWorkspace` is one managed Telegram resource:

```text
group
supergroup
channel
```

Canonical fields include:
- workspace_id — SG-issued stable workspace identifier;
- platform = `telegram`;
- telegram_chat_id — platform locator, not the SG canonical root;
- workspace_type;
- title / username metadata;
- lifecycle state;
- bot membership state;
- bot permission snapshot;
- created/updated timestamps.

Telegram group→supergroup migration must preserve the canonical SG workspace identity and configuration through an explicit migration relation rather than creating silent duplicate workspaces.

### TWM1.1 implementation status
TWM1.1 is **CLOSED / IMPLEMENTED / CI-VERIFIED**. The canonical workspace contract is implemented in `src/telegramWorkspace/`, and canonical request scope now carries optional `ScopeContext.workspaceScope` in `src/contracts/context.js`. The contract preserves an SG-issued `tgw_*` workspace root across Telegram group→supergroup migration and rejects invalid/non-canonical/cross-workspace scope fail-closed.

Evidence: `../../evidence/TWM1_1_WORKSPACE_CONTRACT.md`.
Verified gate: HEAD `fa72678cbd796dd163aa5208c664338ccb73223e`, SG 2.1 CI #7232 — SUCCESS.

### TWM1.2 implementation status
TWM1.2 is **CLOSED / IMPLEMENTED / CI-VERIFIED**. Durable persistence is implemented through the existing SG PostgreSQL migration/runtime boundary in `src/persistence/migrations/900_twm1_workspace_persistence.sql` and `src/telegramWorkspace/postgresWorkspaceStore.js`.

The implemented storage root remains canonical SG `workspace_id`; Telegram chat ids are unique platform locators. Contract-approved workspace/member-role/bot-permission/config/current-history state is persisted, config version + history writes are atomic in one PostgreSQL transaction, stale expected versions fail closed, and secret-shaped config fields are rejected before persistence. PostgreSQL close/reopen and group→supergroup remap behavior are integration-tested without changing canonical workspace identity.

Evidence: `../../evidence/TWM1_2_POSTGRES_WORKSPACE_PERSISTENCE.md`.
Verified implementation gate: HEAD `d106c283ce5b8047e72ce75c209d7e5eebcbebb0`, SG 2.1 CI #7241 — SUCCESS.

### TWM1.3 implementation status
TWM1.3 is **CLOSED / IMPLEMENTED / CI-VERIFIED**. Discovery is wired into the existing PostgreSQL-backed Telegram ingestion path before invocation filtering, so ordinary ignored group/channel updates can register or refresh workspace state without forcing SG to answer.

The implemented registry accepts only group/supergroup/channel facts, refreshes metadata without changing canonical `workspace_id`, tracks bot membership disconnect/reconnect, preserves one SG workspace root through group→supergroup migration, maintains durable migration-alias resolution for stale/replayed pre-migration updates, and exposes bounded workspace listing. Discovery remains transport-fact-only and does not infer human OWNER/ADMIN authority.

Evidence: `../../evidence/TWM1_3_TELEGRAM_WORKSPACE_DISCOVERY_REGISTRY.md`.
Verified implementation gate: HEAD `a007a159ab705d94eb31676115632d3ac71c5377`, SG 2.1 CI #7266 — SUCCESS.

### TWM1.4 implementation status
TWM1.4 is **CLOSED / IMPLEMENTED / CI-VERIFIED**. `TelegramWorkspaceAuthorityResolver` is implemented in `src/telegramWorkspace/telegramWorkspaceAuthorityResolver.js` and exported through the existing TWM module boundary.

The resolver requires a canonical Telegram Identity Link, resolves the exact `workspace_id`, obtains current creator/administrator evidence through the existing Telegram Bot API client (`getChatMember` via the existing client call path), intersects that evidence with bounded workspace role and existing Resource Authority relations, and returns an explicit auditable allow/deny decision. Sensitive actions reverify live Telegram authority; low-risk reads may use only non-expired bounded evidence. Authority loss revokes both the workspace member state and corresponding Resource Authority grant. Workspace OWNER/ADMIN remains workspace-scoped and never creates an SG-global role or Monarch authority.

PostgreSQL acceptance proves scoped member/Resource Authority persistence across restart, followed by fail-closed revocation when Telegram authority is lost. Cross-workspace authority is independently verified against the target Telegram chat rather than inherited from another workspace.

Evidence: `../../evidence/TWM1_4_WORKSPACE_AUTHORITY_VERIFICATION.md`.
Verified implementation gate: HEAD `acd4770cae660a811bb85d64d4ecce961b318c73`, SG 2.1 CI #7274 — SUCCESS.

### TWM1.5 implementation status
TWM1.5 is **CLOSED / IMPLEMENTED / CI-VERIFIED**. `TelegramWorkspaceBotCapabilityService` is implemented in `src/telegramWorkspace/telegramWorkspaceBotCapabilityService.js`, reuses the canonical Telegram Bot API client and the existing `telegram_workspace_bot_permissions` persistence boundary, and is composed in the Render production bootstrap from the same PostgreSQL workspace registry used by discovery.

The service resolves the bot identity through configured `TELEGRAM_BOT_USER_ID` or a cached `getMe` result, performs live `getChatMember` checks for the exact workspace, normalizes Telegram membership and known boolean permission fields, derives bounded SG capability health, persists fetched/expiry timestamps and returns explicit `healthy`, `degraded`, `disconnected` or `verification-failed` results. `requireCapabilities()` fails closed with structured missing-capability/permission diagnostics, so a protected operation cannot claim success when Telegram denies a required permission. Stale healthy evidence is not accepted when a fresh protected check fails.

Capability snapshots are workspace-scoped and PostgreSQL restart-tested; one workspace's permission state cannot satisfy another. No second Telegram transport, credential path, permission database or authorization model is introduced.

Evidence: `../../evidence/TWM1_5_BOT_PERMISSION_DISCOVERY_CAPABILITY_HEALTH.md`.
Verified implementation gate: HEAD `d5d4ebdc68f066ac69877e00cad4db84484fb84b`, SG 2.1 CI #7281 — SUCCESS.

This status makes no claim for TWM1.6+ configuration-service authorization, Action Gate integration, configuration runtime consumption or real Telegram production E2E/live acceptance.

## Identity and authority
Canonical human identity remains `global_user_id`.

```text
telegram platform_user_id
→ verified Identity Link
→ global_user_id
→ workspace-specific authority evidence
→ requested action
```

TWM1 must not infer ownership from names, usernames, first message, first bot invitation or model output.

Telegram creator/administrator status is resource-authority evidence for a concrete workspace. It is not an SG-global role.

Effective permission is bounded by all applicable controls:

```text
effectivePermission =
Telegram resource permission
∩ SG workspace grant/policy
∩ SG bot capability/permission
∩ Action Gate policy
```

A user who loses Telegram authority must lose corresponding TWM authority after re-verification. Sensitive mutations and external effects require fresh or policy-valid authority evidence.

## Workspace roles
TWM1 may expose bounded workspace roles such as:

```text
OWNER
ADMIN
EDITOR
MODERATOR
VIEWER
```

These roles are scoped only to one workspace. They must not grant SG-wide owner/Monarch authority.

Telegram platform status and SG workspace role remain separate facts. Internal grants may be stricter than Telegram permissions but cannot broaden them.

## Workspace lifecycle
Canonical lifecycle:

```text
DISCOVERED
CONNECTED
CONFIGURING
ACTIVE
DEGRADED
DISCONNECTED
REVOKED
```

`DEGRADED` means SG remains connected but lacks one or more permissions/capabilities required by configured behavior.

## Configuration model
Configuration is workspace-scoped and namespace-based:

```text
workspace.general
workspace.responses
workspace.moderation
workspace.memory
workspace.ai
workspace.publication
workspace.content
workspace.polls
workspace.media
workspace.automation
workspace.notifications
workspace.members
```

Representative keys:

```text
workspace.responses.mode = mention_only
workspace.responses.reply_enabled = true
workspace.moderation.spam.enabled = true
workspace.memory.enabled = true
workspace.ai.enabled = true
workspace.content.preview_before_publish = true
```

Configuration is versioned. Every mutation records actor, scope, old value, new value, reason/source, trace id and timestamp.

## Persistence
Implemented by TWM1.2 and consumed by TWM1.5:
- `telegram_workspaces`;
- `telegram_workspace_members`;
- `telegram_workspace_bot_permissions`;
- `telegram_workspace_configs`;
- `telegram_workspace_config_history`.

Planned extension entities include:
- `telegram_workspace_content`;
- `telegram_workspace_media`;
- `telegram_workspace_polls`;
- `telegram_workspace_poll_results`;
- `telegram_workspace_test_sessions`;
- `telegram_workspace_test_results`;
- scheduled-content linkage to the existing durable automation/task scheduler.

All rows are scoped by canonical workspace id. Cross-workspace reads/writes fail closed unless explicitly authorized.

## Workspace Configuration Service
`WorkspaceConfigurationService` is the only TWM service permitted to mutate workspace configuration.

Required responsibilities:
- list/get workspace configuration;
- produce configuration proposals;
- validate schemas and values;
- authorize the requested mutation;
- determine confirmation requirements;
- apply atomic versioned changes;
- expose history;
- rollback to an authorized prior version;
- emit bounded audit/observability events.

Telegram adapters, UI callbacks, AI Router and language responders must not write configuration storage directly.

## Telegram Workspace Registry
`TelegramWorkspaceRegistry` owns resource discovery and metadata state:
- register discovered groups/channels;
- resolve Telegram chat ids to canonical workspace ids;
- refresh title/type/username metadata;
- detect bot removal or reconnect;
- detect group→supergroup migration;
- expose actual bot membership and permissions through the TWM1.5 capability service.

## Authority Resolver
`TelegramWorkspaceAuthorityResolver` evaluates:

```text
global_user_id
+ verified telegram identity link
+ workspace_id
+ requested_action
+ current Telegram resource evidence
+ SG workspace grants
```

Output must be explicit and auditable: allowed/denied, role/grant, Telegram evidence, reason and verification time.

## Bot permission awareness
TWM1.5 implements `TelegramWorkspaceBotCapabilityService` as the canonical bot-permission health boundary.

```text
workspace_id
→ Telegram chat locator
→ bot identity
→ Telegram getChatMember
→ membership + permission snapshot
→ bounded capability map
→ PostgreSQL snapshot with TTL
→ checkCapabilities / requireCapabilities
```

The current capability map covers message send/edit/delete/pin, member restrict/invite, chat/topic management, channel posting, poll sending and media sending. Missing permission is a first-class `degraded` result with actionable `missingPermissions`; bot removal is `disconnected`; live verification failure is `verification-failed`. A configuration or requested external effect may proceed only when its semantics are valid and its required capability health is available.

## Native UX
TWM1 has three UI surfaces over the same backend:

1. **Telegram inline UI** — mandatory first implementation.
2. **Natural-language control** — primary conversational interface.
3. **Telegram Mini App** — later rich management surface.

The Mini App must not contain a parallel authorization or business-logic stack.

### Setup wizard
First-time setup should be progressive and simple:

```text
select workspace purpose
→ choose SG role/behavior
→ choose response mode
→ choose basic moderation/publication/content policy
→ verify bot permissions
→ review
→ activate
```

Templates may provide safe defaults, but template selection never bypasses validation or authorization.

## Natural-language control
Examples:

```text
"SG, in Crypto reply only when mentioned"
"create a 5-question quiz about history for this group"
"publish this photo with my caption"
"post this video tomorrow morning"
"show and analyze the results of yesterday's poll"
```

Natural language must resolve to structured proposals before state changes. No keyword hack may substitute for semantic workspace resolution or authority checks.

## Content, Polls, Quizzes & Media
TWM1.14 adds a workspace-scoped content-management plane over the same authority/runtime backend.

### Workspace Content Service
`WorkspaceContentService` owns draft, publish, edit/close where supported, schedule and status semantics for workspace content.

Content may include:
- text posts;
- user-supplied photos;
- user-supplied videos;
- user-supplied documents;
- Telegram polls;
- Telegram quiz-mode polls;
- SG-managed multi-question test sessions built from bounded question/result records.

Draft creation and actual publication are distinct states. Publication is an external effect and must pass the existing protected execution path.

### Poll / Quiz / Test Manager
`PollQuizManager` / `QuizTestSessionManager` must:
- validate questions/options and Telegram limits at execution time;
- preserve correct-answer metadata for quiz/test scoring where applicable;
- create/close authorized polls where Telegram permits;
- ingest Telegram poll/result updates idempotently;
- maintain SG-managed multi-question test sessions separately from single Telegram poll objects;
- preserve workspace and participant/privacy boundaries.

### Workspace Media Manager
`WorkspaceMediaManager` handles media that authorized users provide to SG.

Rules:
- retain provenance linking media use to actor/workspace/request;
- use Telegram reusable file identifiers when appropriate rather than unnecessarily copying media bytes;
- never treat a file seen in Workspace A as automatically available in Workspace B;
- never imply media generation capability merely because media publication is supported;
- publishing/editing/deleting media content still requires current authority and bot capability.

### Result collection and deterministic statistics
Numeric results are computed by code from structured events, not invented by AI:

```text
raw Telegram / SG result events
→ normalize + deduplicate
→ deterministic vote/answer/score counts
→ deterministic percentages/aggregates
→ versioned ResultSnapshot
→ optional AI Router interpretation
```

The statistics engine owns exact totals, percentages, participant/result cardinality and scores. AI Router may summarize trends, explain patterns, analyze free-text answers or suggest follow-up questions, but cannot override the computed metrics.

### Poll privacy
Anonymous Telegram polls remain anonymous. SG may expose only aggregate data actually available from Telegram and must not claim participant-level identities for anonymous votes.

Non-anonymous result records remain workspace-scoped and subject to SG privacy/retention policy.

### Scheduled content
Scheduled publication reuses existing durable automation/scheduler infrastructure. Execution-time checks must revalidate resource authority and bot capability where policy requires it; creation-time authority alone is not a permanent grant.

## Confirmation and risk
Low-risk reversible settings may use policy-approved immediate apply.

Protected or high-impact actions require explicit preview/confirmation and Action Gate handling, including mass moderation, broad publication, role changes, destructive changes, scheduled external delivery or other material external effects.

## Workspace memory boundary
Workspace memory is a separate scope from personal memory and Project Memory.

```text
user memory ≠ workspace memory ≠ project memory
```

Private user facts must not become group/channel memory merely because the same user administers that workspace. Workspace configuration/content cannot weaken Memory 2.0 privacy/scope rules.

## Audit and rollback
Every accepted configuration mutation must provide an auditable history and authorized rollback path. Content actions must also emit auditable actor/workspace/action/result evidence appropriate to the operation.

Users with sufficient authority should be able to ask who changed a setting, when it changed and restore an earlier version. Rollback itself is a new audited state-changing action.

## Diagnostics and observability
TWM1 should expose bounded secret-safe health such as:
- workspace connection state;
- authority verification state;
- bot permission health;
- configuration version;
- content/poll subsystem health;
- degraded configured capabilities;
- last successful/failed configuration/content mutation;
- result-ingestion freshness/replay counters;
- authorization denials.

TWM1.5 emits bounded bot-capability health audit/telemetry from the production service without exposing bot credentials or cross-workspace private data.

## Isolation
Hard rule:

```text
Workspace A ≠ Workspace B
```

Settings, members, memory, automation, media, drafts, publications, poll/test results and authority/capability evidence do not cross workspace boundaries by default, even when the same human administers both.

## Reuse of existing SG layers
TWM1 MUST reuse:
- Telegram Production Integration / thin transport adapter;
- canonical `global_user_id` and Identity Links;
- Identity & Scope;
- Resource Ownership & Authority;
- Decision / Action Gate;
- Configuration & Policy boundaries;
- PostgreSQL persistence;
- Durable Automation / Scheduler for scheduled content;
- Memory 2.0 scope/privacy rules;
- AI Router;
- Observability and Internal Event Bus;
- Delivery Router where outbound delivery is required.

## Non-negotiable boundaries
- no second Telegram transport;
- no second identity root;
- no username/name/phrase ownership hacks;
- no AI→database configuration/content/result path;
- no model-created authority;
- no automatic promotion of Telegram admin to SG-global admin/owner;
- no cross-workspace configuration, media, result or memory leakage;
- no success claim when Telegram denies required bot permissions;
- no hidden destructive/external actions without required confirmation;
- no configuration setting may weaken mandatory security, owner security or Action Gate policy;
- no model-generated numeric poll/test statistics when structured evidence exists;
- no deanonymization claim for anonymous Telegram polls;
- bot tokens/secrets remain outside ordinary workspace configuration/content/model context.

## Definition of architectural success
TWM1 architecture is satisfied when one shared backend can safely support many users and many independent Telegram groups/channels, where each authorized user can configure and operate only resources they are currently permitted to control, all changes/actions are auditable, workspace content/results remain isolated, deterministic statistics are evidence-backed, and SG runtime consumes the resulting workspace state without bypassing existing SG control layers.
