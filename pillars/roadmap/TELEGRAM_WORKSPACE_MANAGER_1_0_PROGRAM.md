# SG 2.1 — TELEGRAM WORKSPACE MANAGER 1.0 PROGRAM

## Status
**IN PROGRESS — TWM1.1–TWM1.10 CLOSED / TWM1.11 NEXT.**

TWM1 is the cross-cutting Telegram workspace management program that lets any authorized SG user configure SG for their own Telegram groups, supergroups and channels through native Telegram UI and natural language.

TWM1 does not renumber Blocks 0–19 and does not replace Block 14 Telegram Production Integration. It depends on the existing Telegram transport/runtime, Identity & Scope, Resource Authority, Action Gate, Configuration/Policy, PostgreSQL, AI Router, Memory 2.0 isolation and Observability.

## Goal
Deliver this real-user flow:

```text
user opens SG
→ connects/discovers Telegram workspace
→ SG verifies user authority
→ SG verifies its own bot permissions
→ user completes simple setup
→ configuration is persisted per workspace
→ runtime behavior changes
→ changes survive restart
→ unauthorized users cannot mutate settings
→ authority loss revokes control
→ history/rollback/diagnostics remain available
```

## Canonical implementation order

### TWM1.1 — Workspace Contract & Lifecycle
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented:
- canonical `TelegramWorkspace` contract and SG-issued `workspace_id`;
- workspace types: group, supergroup, channel;
- lifecycle: DISCOVERED, CONNECTED, CONFIGURING, ACTIVE, DEGRADED, DISCONNECTED, REVOKED;
- strict workspace scope fields in request/action context;
- canonical `ScopeContext.workspaceScope` integration;
- group→supergroup migration semantics that preserve the SG workspace root;
- no ownership inference from name, username, first message or invitation order.

**Gate:** deterministic contract and canonical scope-integration tests pass; invalid/non-canonical/cross-workspace identities fail closed.

Evidence: `../../evidence/TWM1_1_WORKSPACE_CONTRACT.md`.
Verified implementation gate: HEAD `fa72678cbd796dd163aa5208c664338ccb73223e`, SG 2.1 CI #7232 — SUCCESS.

### TWM1.2 — PostgreSQL Workspace Persistence
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented durable PostgreSQL persistence for:
- `telegram_workspaces`;
- `telegram_workspace_members`;
- `telegram_workspace_bot_permissions`;
- `telegram_workspace_configs`;
- `telegram_workspace_config_history`.

Implemented requirements:
- existing canonical SG migrator reused; no second persistence stack;
- unique Telegram resource mapping with SG-issued `workspace_id` as canonical root;
- workspace-scoped member/role, permission, config and history storage;
- transactional current-config update + version-history insertion;
- optimistic `expectedVersion` conflict guard;
- PostgreSQL close/reopen durability;
- group→supergroup Telegram locator remap preserving canonical workspace identity;
- recursive secret-shaped config/permission field rejection before persistence;
- SG 2.0 migration compatibility and canonical migration-count regression coverage.

**Gate: PASS.** Persistence survives PostgreSQL restart with config/history intact and no cross-workspace leakage; stale version writes fail closed; full SG 2.1 CI passes.

Evidence: `../../evidence/TWM1_2_POSTGRES_WORKSPACE_PERSISTENCE.md`.
Verified implementation gate: HEAD `d106c283ce5b8047e72ce75c209d7e5eebcbebb0`, SG 2.1 CI #7241 — SUCCESS.

### TWM1.3 — Telegram Workspace Discovery & Registry
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented:
- discovery from real Telegram update shapes through the existing production ingestion path;
- explicit canonical registration/resolution for group, supergroup and channel resources;
- metadata refresh without changing SG `workspace_id`;
- bot membership state tracking;
- removal/disconnect and reconnect handling;
- group→supergroup migration preserving one canonical workspace root;
- durable migration-alias resolution so stale/replayed old-group updates cannot recreate duplicate roots;
- bounded workspace listing from PostgreSQL registry;
- discovery before invocation filtering so ignored ambient group/channel traffic can still update registry state;
- no human authority inference from title, username, inviter, message content or bot-add order.

**Gate: PASS.** Repeated updates are replay-safe/idempotent; multiple Telegram workspaces remain independent; group→supergroup migration and stale replay preserve one SG workspace root; PostgreSQL restart preserves resolution state; full SG 2.1 CI passes.

Evidence: `../../evidence/TWM1_3_TELEGRAM_WORKSPACE_DISCOVERY_REGISTRY.md`.
Verified implementation gate: HEAD `a007a159ab705d94eb31676115632d3ac71c5377`, SG 2.1 CI #7266 — SUCCESS.

### TWM1.4 — Workspace Authority Verification
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented `TelegramWorkspaceAuthorityResolver` over existing SG authority primitives:
- canonical Telegram Identity Link resolves platform user id to `global_user_id`;
- canonical `workspace_id` selects the exact Telegram resource locator;
- current creator/administrator evidence is obtained through the existing Telegram Bot API client using `getChatMember`;
- Telegram creator/admin evidence is intersected with bounded workspace roles and existing Resource Authority relations;
- sensitive workspace actions always reverify live Telegram authority;
- low-risk read evidence may be cached only within a bounded TTL and must still pass non-expired Resource Authority;
- live authority loss revokes the workspace member and existing Resource Authority grants;
- SG workspace role may be stricter than Telegram status but cannot broaden Telegram authority;
- no workspace OWNER/ADMIN mapping writes SG-global roles or Monarch authority;
- PostgreSQL restart preserves scoped member/Resource Authority state, followed by live revocation on the next sensitive check.

Implementation paths:
- `src/telegramWorkspace/telegramWorkspaceAuthorityResolver.js`;
- `src/telegramWorkspace/index.js`;
- `tests/telegramWorkspaceManager1Authority.test.js`;
- `tests/telegramWorkspaceManager1AuthorityPostgres.test.js`.

**Gate: PASS.** Creator/admin allowed where policy permits; ordinary member denied; cross-workspace admin denied; stale/revoked evidence denied after policy re-verification; stricter SG role intersection enforced; no SG-global escalation; PostgreSQL restart continuity passes.

Evidence: `../../evidence/TWM1_4_WORKSPACE_AUTHORITY_VERIFICATION.md`.
Verified implementation gate: HEAD `acd4770cae660a811bb85d64d4ecce961b318c73`, SG 2.1 CI #7274 — SUCCESS.

### TWM1.5 — Bot Permission Discovery & Capability Health
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented `TelegramWorkspaceBotCapabilityService` over the existing Telegram Bot API client and TWM PostgreSQL store:
- bot identity comes from configured bot user id or one cached `getMe` lookup;
- live `getChatMember` reads actual bot membership and Telegram permission fields for the exact workspace;
- group/supergroup/channel facts are normalized into bounded SG capabilities for message send/edit/delete/pin, member restrict/invite, chat/topic management, channel posting, polls and media;
- snapshots persist in existing `telegram_workspace_bot_permissions` with `fetched_at` / `expires_at`;
- bounded cache is accepted only within TTL;
- protected checks default to live re-verification;
- missing permission returns explicit `degraded` health with `missingCapabilities` and `missingPermissions`;
- bot removal returns `disconnected`;
- live verification failure returns `verification-failed` and cannot reuse stale healthy evidence for protected execution;
- `requireCapabilities()` fails closed with structured actionable diagnostics;
- Render production bootstrap creates this service from the same PostgreSQL workspace registry/store used by TWM discovery;
- no second transport, credential path, persistence stack or permission database is introduced.

Implementation paths:
- `src/telegramWorkspace/telegramWorkspaceBotCapabilityService.js`;
- `src/telegramWorkspace/index.js`;
- `src/telegram/telegramBotApiClient.js`;
- `src/runtime/renderWebApplication.js`;
- `tests/telegramWorkspaceManager1BotCapability.test.js`;
- `tests/telegramWorkspaceManager1BotCapabilityPostgres.test.js`.

**Gate: PASS.** Missing bot permission cannot report capability success; group/channel capability mapping, disconnect, TTL refresh, API failure fail-closed semantics, automatic bot identity resolution, multi-workspace isolation and PostgreSQL restart/downgrade behavior pass in the full SG 2.1 CI.

Evidence: `../../evidence/TWM1_5_BOT_PERMISSION_DISCOVERY_CAPABILITY_HEALTH.md`.
Verified implementation gate: HEAD `d5d4ebdc68f066ac69877e00cad4db84484fb84b`, SG 2.1 CI #7281 — SUCCESS.

### TWM1.6 — Workspace Configuration Service
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented the sole TWM workspace-configuration mutation surface:
- authorized get/list config;
- structured change proposals;
- bounded schema/value/JSON validation and secret-field rejection;
- fresh `workspace:configure` authority evaluation for mutations;
- deterministic risk classification and confirmation requirement;
- atomic versioned apply through the existing TWM1.2 PostgreSQL store;
- optimistic stale-proposal conflict protection;
- append-only history;
- authorized rollback as a new configuration version;
- metadata-only audit and Internal Event Bus emission.

Managed namespaces:
- general;
- responses;
- moderation;
- memory;
- ai;
- publication;
- automation;
- notifications;
- members.

`content`, `polls` and `media` remain persistence-reserved for later TWM stages and are not accepted by the TWM1.6 mutation service.

Implementation paths:
- `src/telegramWorkspace/workspaceConfigurationService.js`;
- `src/telegramWorkspace/index.js`;
- `src/runtime/renderWebApplication.js`;
- existing `src/telegramWorkspace/postgresWorkspaceStore.js` and TWM1.2 migration reused without a second persistence stack.

Tests:
- `tests/telegramWorkspaceManager1Configuration.test.js`;
- `tests/telegramWorkspaceManager1ConfigurationPostgres.test.js`;
- `tests/telegramWorkspaceManager1ConfigurationBoundary.test.js`.

**Gate: PASS.** Application code has one workspace-config write owner (`WorkspaceConfigurationService`); direct SQL config writes remain inside `PostgresTelegramWorkspaceStore`; stale proposals/unauthorized actors fail closed; rollback preserves full history; PostgreSQL restart and multi-workspace isolation pass.

Evidence: `../../evidence/TWM1_6_WORKSPACE_CONFIGURATION_SERVICE.md`.
Verified implementation gate: HEAD `7a36c708f916d1ae375d238b22416bd5cd86a5fa`, SG 2.1 CI #7293 — SUCCESS.

TWM1.6 owns deterministic risk classification and the sole config write surface. TWM1.7 adds the canonical SG Action Gate as a mandatory internal mutation boundary; TWM1.6 risk may tighten policy but can never weaken the global protected-action floor.

### TWM1.7 — Decision / Action Gate Integration
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented canonical protected-action convergence for workspace configuration mutations:

```text
request / structured proposal
→ exact workspace + canonical actor
→ TWM1.6 validation
→ fresh workspace:configure authority
→ service-derived risk
→ canonical ActionRequest
→ existing SG Action Gate
→ request-bound confirmation + idempotency
→ allow only
→ atomic TWM1.2 config write/history
→ metadata-only audit / event
```

Implemented properties:
- `WorkspaceConfigurationService` cannot be constructed without a protected `mutationGate`;
- `apply`, proposal application and rollback evaluate the mutation gate before the sole `workspaceStore.setConfig(...)` call;
- `TelegramWorkspaceActionGateIntegration` reuses canonical `createActionRequest` and `harness.actionGate.evaluate`;
- exact project/workspace scope, canonical actor, `workspace:configure`, Resource Authority evidence, risk, trace/request identity and idempotency are carried into the ActionRequest;
- non-`allow` gate outcomes fail closed before persistence;
- canonical request-bound confirmation replaces the old service-only boolean confirmation as execution authority;
- current SG protected-action policy remains the floor, so TWM configuration cannot weaken mandatory confirmation/security behavior;
- caller/model input cannot downgrade service-derived risk;
- replayed authorized requests cannot create a second config write;
- rollback is a separate protected state-changing operation and still creates a new append-only version;
- unauthorized authority fails before Action Gate and persistence;
- Render reuses the existing production `harness.actionGate`, policy layer, Resource Authority, PostgreSQL, Observability and Event Bus; no parallel Action Gate or config persistence exists;
- guarded Render composition remains backward compatible for minimal non-TWM harnesses while real TWM runtime fails closed if canonical Action Gate is missing.

Implementation paths:
- `src/telegramWorkspace/telegramWorkspaceActionGateIntegration.js`;
- `src/telegramWorkspace/workspaceConfigurationService.js`;
- `src/telegramWorkspace/index.js`;
- `src/runtime/renderWebApplication.js`.

Tests:
- `tests/telegramWorkspaceManager1ActionGate.test.js`;
- `tests/telegramWorkspaceManager1ActionGatePostgres.test.js`;
- `tests/telegramWorkspaceManager1ConfigurationBoundary.test.js`;
- TWM1.6 configuration unit/PostgreSQL suites exercise the protected mutation boundary.

**Gate: PASS.** Unconfirmed/denied mutations write nothing; confirmed request-bound mutation writes once; replay is rejected; risk downgrade is blocked; rollback is separately gated; PostgreSQL restart preserves the version chain; the only application config-write owner is internally Action-Gated; full SG 2.1 code/runtime CI passes.

Evidence: `../../evidence/TWM1_7_DECISION_ACTION_GATE_INTEGRATION.md`.
Verified code/runtime gate: HEAD `747a821de5a4fd19be766e0583e005b6ee8e38c0`, SG 2.1 CI #7307 — SUCCESS.

TWM1.7 establishes the mandatory backend mutation boundary. TWM1.8 and TWM1.9 now reuse that same sole Action-Gated write owner; TWM1.10 makes live Telegram runtime consume the resulting configuration without bypassing it.

### TWM1.8 — Telegram Native UI & Setup Wizard
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented Telegram-native inline-keyboard management as a thin presentation/controller layer over the existing TWM backend:
- authority-filtered list/select workspaces;
- connect instructions and progressive setup wizard;
- response, moderation and publication settings;
- memory/AI/automation/notifications;
- members/roles;
- diagnostics/history/rollback;
- preview→explicit confirmation→TWM1.6/TWM1.7 protected apply;
- rollback as a separately confirmed protected mutation;
- production routing before ordinary Semantic Runtime for TWM UI callbacks/commands while ordinary messages remain unchanged.

UI callbacks never encode authority; identity, exact workspace scope and authorization are re-resolved server-side. No JSON, `.env`, database access or programming is required for the first setup flow.

**Gate: PASS.** Non-technical native Telegram setup, authority isolation, preview-without-write, request-bound confirmation, rollback, diagnostics and ordinary-runtime preservation are covered by automated tests; full SG 2.1 CI passed on the final stage HEAD.

Evidence: `../../evidence/TWM1_8_TELEGRAM_NATIVE_UI_SETUP_WIZARD.md`.
Verified final gate: HEAD `dda7f2ec3188bb1f9b25cc8951caca484ca8aab6`, SG 2.1 CI #7323 — SUCCESS.

### TWM1.9 — Natural-Language Configuration
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented ordinary-language Telegram workspace configuration through the existing AI Router with bounded structured output. AI/model output remains non-authoritative data and cannot grant workspace authority or write configuration directly.

Implemented path:

```text
ordinary Telegram request
→ existing invocation boundary + canonical identity
→ authority-filtered workspace candidates / exact chat scope
→ AI Router bounded structure (`configure` / `history-query` / `not-twm`)
→ deterministic workspace resolution and bounded patch validation
→ TWM1.6 proposal/current-config merge
→ durable actor-bound TTL pending proposal
→ explicit Telegram confirmation
→ exact stored proposal + original request id
→ TWM1.7 Action Gate
→ atomic PostgreSQL config/history write
```

Private-chat ambiguity asks the user to select/name the workspace instead of guessing. Group/supergroup/channel context is authoritative and model cross-workspace redirection is rejected. Classification failure or `not-twm` falls through to ordinary SG runtime; protected TWM callbacks fail closed. History answers use stored deterministic config history rather than model-invented actor/version/time. Existing unrelated settings are preserved by deterministic deep merge.

**Gate: PASS.** Proposal-without-write, exact confirmation, replay/expiry/actor mismatch rejection, group scope, private ambiguity, history, classifier fallback, PostgreSQL restart and legacy Telegram/persistence compatibility all pass; ordinary Telegram webhook success remains backward-compatible.

Evidence: `../../evidence/TWM1_9_NATURAL_LANGUAGE_CONFIGURATION.md`.
Verified final closure: HEAD `c5da8de6aa87489e0423b512920cf3a0875037f9`, SG 2.1 CI #7347 — SUCCESS.

### TWM1.10 — Workspace Runtime Wiring
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Persisted workspace settings are now consumed by the existing Telegram production runtime without creating a second transport or policy engine.

Implemented runtime behavior:
- workspace config is resolved per Telegram chat on every request, so committed settings take effect without stale in-process policy cache;
- `responses.mode=off` rejects otherwise accepted workspace invocations;
- `responses.mode=all` admits ordinary ambient group traffic while preserving unrelated invocation rejections;
- `mention_only` preserves the existing Telegram invocation boundary;
- `ai.enabled=false` fails closed before the SG Semantic Runtime/AI path;
- effective workspace policy is propagated as immutable `workspaceRuntimePolicy` into canonical runtime metadata and response context;
- `memory.enabled=false` excludes shared `group-memory`/`thread-memory` from response-context recall while preserving authorized personal/user-group/project memory;
- explicit Memory 2.0 shared writes and promotion to group/thread fail closed with `workspace-memory-disabled`;
- explicit recall cannot recover group/thread memory while workspace memory is disabled;
- automatic capture from a disabled Telegram workspace is suppressed before Memory 2.0 persistence;
- moderation/publication/automation/notifications/member configuration is propagated as bounded runtime policy for existing/later capability consumers;
- unmanaged Telegram chats remain on the existing SG runtime path.

Implementation paths:
- `src/telegramWorkspace/telegramWorkspaceRuntimeWiring.js`;
- `src/runtime/renderWebApplication.js`;
- `src/runtime/createProductionRuntime.js`;
- `src/response/boundedResponseContext.js`;
- `src/memory2/memory2Capabilities.js`.

Tests:
- `tests/telegramWorkspaceManager1RuntimeWiring.test.js`;
- `tests/telegramWorkspaceManager1MemoryIsolation.test.js`;
- existing response-context/runtime suites remain green.

**Gate: PASS.** The TWM1.10 runtime behavior and memory read/write/capture isolation passed the full SG 2.1 CI on implementation HEAD `3004dfe4665327db0d830d5ecc52c36cdb948307`, SG 2.1 CI #7368 — SUCCESS. A final full CI is still required on the documentation-synchronized closure HEAD before the stage is announced CLOSED externally.

Evidence: `../../evidence/TWM1_10_WORKSPACE_RUNTIME_WIRING.md`.

### TWM1.11 — Audit, Rollback, Diagnostics & Observability
**Status: PLANNED / NEXT.**

Implement:
- who/what/when/before/after history;
- authorized rollback as a new audited mutation;
- connection/authority/bot-permission/config health;
- degraded capability explanations;
- last config success/failure;
- authorization denial and action counters;
- trace-id continuity and secret-safe observability.

**Gate:** SG can answer who changed a setting and restore an allowed prior configuration version.

### TWM1.12 — Production E2E & Live Acceptance
**Status: PLANNED.**

Prove with real Telegram group and channel flows:

```text
new SG user
→ add SG to workspace
→ workspace discovered
→ authority verified
→ bot permissions verified
→ setup completed
→ config saved
→ runtime behavior changes
→ restart preserves config
→ ordinary member denied mutation
→ admin allowed mutation
→ admin loses Telegram rights
→ further mutation denied
→ second workspace remains isolated
→ audit/history correct
```

Repeat equivalent channel acceptance for publication/configuration semantics.

**Gate:** complete real Telegram production acceptance with CI plus live evidence appropriate to the claim.

### TWM1.13 — Telegram Mini App
**Status: PLANNED AFTER TWM1.12.**

Add optional rich UI over the same TWM backend for complex management, statistics and large configuration sets.

The Mini App cannot create a second authorization, configuration or business-logic stack.

**Gate:** parity with backend authorization and config semantics; disabling Mini App does not disable chat/inline management.

### TWM1.14 — Content, Polls, Quizzes & Media Management
**Status: PLANNED.**

Extend TWM1 so an authorized workspace manager can ask SG to create, publish, schedule, collect and analyze Telegram content inside their own groups/channels.

Supported content operations:
- create ordinary text posts;
- publish user-supplied photos, videos and documents;
- publish text with attached/related media where Telegram semantics allow;
- create Telegram polls;
- create Telegram quiz-mode polls with a configured correct answer where supported;
- create multi-question SG-managed tests as a sequence/session of Telegram content and result records;
- save drafts before publication;
- schedule publication through the existing durable automation/scheduler path;
- stop/close polls where the actor and bot have required authority;
- collect Telegram poll updates and SG-managed test responses;
- build deterministic result snapshots and reports;
- route bounded result interpretation/summarization through AI Router only after deterministic counting.

Natural-language examples:

```text
"SG, create a 5-question quiz about history for this group"
"publish this photo with the text I sent"
"post this video in my channel tomorrow morning"
"show the results of yesterday's poll"
"analyze where participants made the most mistakes"
```

Planned services/components:
- `WorkspaceContentService`;
- `PollQuizManager`;
- `WorkspaceMediaManager`;
- `PollResultCollector`;
- `Quiz/TestSessionManager`;
- deterministic `WorkspaceStatisticsEngine`;
- bounded `WorkspaceResultAnalysis` through AI Router.

Planned persistence includes workspace-scoped entities equivalent to:
- `telegram_workspace_content`;
- `telegram_workspace_media`;
- `telegram_workspace_polls`;
- `telegram_workspace_quizzes` / test sessions;
- `telegram_workspace_poll_results`;
- `telegram_workspace_test_results`;
- `telegram_workspace_content_schedule` or an explicit link to the existing durable task scheduler.

Media rules:
- media received from an authorized user remains provenance-bound to that user/workspace request;
- Telegram reusable file identifiers may be stored where appropriate instead of duplicating bytes;
- media must never cross workspace/user boundaries merely because SG has seen it elsewhere;
- publication requires current Resource Authority plus required SG bot permissions;
- TWM1 does not imply SG can generate new image/video content unless a separate approved media-generation capability exists.

Statistics rule:

```text
raw Telegram/SG response events
→ deterministic normalization/deduplication
→ deterministic counts/scores/percentages
→ immutable result snapshot/version
→ optional AI Router analysis/explanation
```

AI may explain patterns, summarize free-text answers or suggest follow-up questions, but AI must not be the source of numeric counts, vote totals, scores, percentages or participant cardinality when those can be computed from structured evidence.

Privacy and visibility:
- anonymous Telegram polls remain anonymous to SG except for aggregate data Telegram actually exposes;
- SG must not claim participant-level identity for anonymous votes;
- non-anonymous response handling remains workspace-scoped and subject to existing privacy/retention policy;
- reports shown to users must respect Telegram visibility plus SG Resource Authority.

Action/risk rules:
- draft creation may be prepare-only;
- actual publication, poll creation/closure, scheduled delivery and deletion/editing are external state-changing actions and must pass existing Action Gate policy;
- scheduling revalidates authority/capability at execution time where required rather than trusting only creation-time authority;
- missing bot posting/media/poll permissions fail closed with an actionable explanation.

**Gate:** production acceptance proves an authorized user can create and publish a poll/quiz, publish supplied photo/video content, schedule content, receive result updates, obtain deterministic statistics after restart/replay without double counting, receive bounded AI analysis of the deterministic result snapshot, and that unauthorized/cross-workspace users cannot publish, read protected results or reuse media outside allowed scope.

### TWM1.15 — Community Operations, Engagement & Analytics
**Status: PLANNED.**

TWM1.15 turns the configured Telegram workspace into a broader community-operations surface while reusing the same SG core. It is split into five bounded packages:

```text
TWM Content
TWM Engagement
TWM Community
TWM Operations
TWM Analytics
```

Planned capabilities include:
- multi-step forms/questionnaires and feedback;
- events, RSVP, capacity, waitlists and reminders;
- competitions/challenges/draws with deterministic auditable eligibility/selection mechanics where applicable;
- workspace FAQ/approved knowledge and newcomer onboarding;
- unanswered-question and moderation queues;
- request/case/ticket lifecycle and operator assignment;
- tasks and reminders through the existing SG task/automation system;
- proposal→discussion→optional vote→authorized decision confirmation→optional Group Shared Memory promotion;
- content calendar, editorial queues and recurring rubrics over TWM1.14;
- bounded discussion summaries that remain derived until explicitly confirmed;
- deterministic workspace analytics from normalized structured events;
- owner daily/weekly/monthly briefs;
- authorized report/export paths where SG artifact capabilities support them.

TWM1.15 MUST NOT create a second memory, task, scheduler, identity, authority or analytics-truth system. Private form/case/feedback data cannot silently enter shared memory or FAQ. Poll/test results do not become binding decisions automatically. AI Router may classify, summarize and interpret bounded data, but exact metrics/state transitions remain deterministic and AI cannot mutate state or grant authority.

Detailed implementation sequence and gates are canonical in `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_PROGRAM.md`.
Architecture: `../architecture/TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS.md`.
Workflow: `../workflow/TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_WORKFLOW.md`.

## UX principles
- natural language is primary;
- Telegram-native inline UI is the first visual control plane;
- setup is wizard-based and progressive;
- technical identifiers are hidden unless diagnostic detail is requested;
- SG explains missing permissions in user language;
- dangerous changes show impact before execution;
- one user may manage many workspaces;
- one workspace may have multiple authorized managers with bounded roles;
- content creation should use draft/preview flows when publication impact is material;
- statistics should distinguish exact deterministic metrics from AI interpretation;
- community workflows expose clear statuses/queues instead of raw storage structures.

## Security boundaries
TWM1 must never:
- treat Telegram username/name as identity or authority;
- treat any Telegram administrator as SG owner/Monarch;
- let AI write config or publication/result/operations state directly;
- let a config key weaken mandatory SG security/Action Gate/owner security;
- leak settings, memory, members, media, drafts, responses, results, forms, cases, feedback, analytics or audit between workspaces;
- store bot tokens/secrets in ordinary workspace config/content records;
- claim success when Telegram denies the required action;
- persist stale authority indefinitely without re-verification policy;
- invent poll/test/workspace statistics from model output;
- deanonymize anonymous Telegram polls or promise anonymous forms when identifiers are retained;
- convert a poll/test result into a binding decision or confirmed shared-memory fact without the required policy/authorization transition.

## Dependencies
Uses existing:
- Block 14 Telegram Production Integration;
- Identity & Scope / canonical `global_user_id`;
- Block 16.10 Resource Ownership & Authority;
- Decision / Action Gate;
- Block 16.7 Configuration & Policy;
- PostgreSQL persistence;
- Memory 2.0;
- Session & Conversation Context;
- AI Router;
- Durable Automation / Scheduler;
- existing task/capability system;
- Delivery Router;
- Observability / Internal Event Bus;
- Security & Operations controls.

## Definition of DONE
Core TWM workspace management is complete when TWM1.1–TWM1.12 are implemented, tested, CI-verified and live-accepted, and any authorized ordinary SG user can safely configure their own Telegram groups/channels without programming while unauthorized users cannot. TWM1.13 remains an optional richer UI extension. TWM1.14 and TWM1.15 are separately closable functional extensions. TWM1.14 requires real Telegram content/poll/quiz/media/result E2E; TWM1.15 requires TWM1.15.1–TWM1.15.13 code, tests, CI and live acceptance proving community workflows, deterministic analytics, restart/replay safety, privacy/authority and workspace isolation.