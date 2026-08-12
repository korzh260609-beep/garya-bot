# SG 2.1 — TELEGRAM WORKSPACE MANAGER 1.0 WORKFLOW

## Status
**IN PROGRESS — TWM1.1–TWM1.9 CLOSED / TWM1.10 NEXT.**

This workflow defines how TWM1 stages are implemented and verified without bypassing existing SG identity, authority, Action Gate, persistence, memory or transport boundaries.

## Global implementation rule
For every TWM stage:

```text
contract
→ persistence/schema where needed
→ deterministic service logic
→ authority/action-gate integration
→ Telegram/runtime wiring
→ tests
→ CI
→ live acceptance when the claim is production/live
→ documentation synchronization
```

No stage is CLOSED from documentation status alone.

## Preconditions
Before implementing a TWM stage:
1. verify current `dev/sg2.1-semantic` HEAD;
2. verify latest SG 2.1 CI result;
3. inspect actual relevant code/tests;
4. confirm prior TWM dependency stage is CLOSED where the stage requires it;
5. preserve `main` as non-authoritative for SG 2.1 state evaluation.

## TWM1.1 — Workspace Contract & Lifecycle
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented canonical contracts first, with deterministic tests for valid workspace types/lifecycle, canonical workspace ids, scope isolation and Telegram group→supergroup migration mapping. Persistence behavior remains intentionally deferred to TWM1.2.

Acceptance passed: invalid/non-canonical/cross-workspace context fails closed; canonical `ScopeContext.workspaceScope` is integrated; no ownership is inferred from metadata or invitation order.

Evidence: `../../evidence/TWM1_1_WORKSPACE_CONTRACT.md`.
Verified gate: HEAD `fa72678cbd796dd163aa5208c664338ccb73223e`, SG 2.1 CI #7232 — SUCCESS.

## TWM1.2 — PostgreSQL Workspace Persistence
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented contract-approved PostgreSQL schema/store primitives for workspaces, members/roles, bot-permission snapshots, current configuration and version history. Writes reuse the canonical SG persistence/migrator; configuration current-version update and history insertion are transactional, canonical `workspace_id` scopes reads/writes, and secret-shaped config fields are rejected before persistence.

Acceptance passed: PostgreSQL close/reopen preserves workspace/member/permission/config/history state; independent workspaces remain isolated; optimistic stale-version writes fail closed; group→supergroup remapping preserves the SG workspace root; SG 2.0→SG 2.1 migration compatibility remains green.

Evidence: `../../evidence/TWM1_2_POSTGRES_WORKSPACE_PERSISTENCE.md`.
Verified implementation gate: HEAD `d106c283ce5b8047e72ce75c209d7e5eebcbebb0`, SG 2.1 CI #7241 — SUCCESS.

This stage persists scoped role/permission/configuration state only. It does not claim Telegram discovery, live authority proof, live bot-permission discovery, authorized configuration service/runtime wiring or live Telegram acceptance from TWM1.3+.

## TWM1.3 — Workspace Discovery & Registry
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Real Telegram update facts are wired into a thin discovery adapter feeding `TelegramWorkspaceRegistry`. Transport reports platform facts only; registry owns canonical workspace creation/resolution and PostgreSQL-backed metadata state. Discovery runs before invocation filtering, so ignored ambient group/channel traffic still discovers or refreshes workspace state without causing an SG response.

Implemented handling includes group/supergroup/channel extraction, private-chat exclusion, metadata refresh, bot membership disconnect/reconnect, group→supergroup migration, durable migration-alias resolution for stale/replayed old-group updates, bounded listing and PostgreSQL restart continuity. No human OWNER/ADMIN authority is inferred at this stage.

Acceptance passed: discovery is replay-safe/idempotent; multiple workspaces remain independent; migration and stale replay preserve one canonical SG workspace root; full SG 2.1 CI passes.

Evidence: `../../evidence/TWM1_3_TELEGRAM_WORKSPACE_DISCOVERY_REGISTRY.md`.
Verified implementation gate: HEAD `a007a159ab705d94eb31676115632d3ac71c5377`, SG 2.1 CI #7266 — SUCCESS.

## TWM1.4 — Authority Verification
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented `TelegramWorkspaceAuthorityResolver` by reusing canonical Identity Links, the existing Telegram Bot API client, durable workspace member state and existing Resource Authority.

Verification sequence:

```text
telegram platform_user_id
→ canonical Identity Link
→ global_user_id
→ exact workspace_id / Telegram chat locator
→ getChatMember current evidence when policy requires
→ bounded TWM workspace role
→ existing Resource Authority relation/TTL/state
→ explicit allow/deny decision
```

Sensitive actions always reverify live Telegram authority. Low-risk read checks may reuse only policy-valid bounded evidence and still require an active non-expired Resource Authority grant. Creator maps to initial workspace `OWNER`; administrator maps to initial `ADMIN`; existing SG workspace role may remain stricter. Live loss of creator/admin status revokes the workspace member and active Resource Authority grant. No workspace role is written into SG-global roles or Monarch authority.

Acceptance passed:
- creator/admin allowed where policy permits;
- ordinary member denied;
- cross-workspace admin denied because the target workspace is independently checked;
- stale low-risk evidence expires and is reverified;
- revoked admin evidence is denied and the persisted authority grant is revoked;
- Telegram verification failure denies sensitive actions fail-closed;
- existing stricter SG workspace role cannot be broadened by Telegram admin status;
- canonical Identity Link mismatch is denied before Telegram authority query;
- PostgreSQL restart preserves scoped member/Resource Authority state without SG-global escalation.

Implementation/tests:
- `src/telegramWorkspace/telegramWorkspaceAuthorityResolver.js`;
- `src/telegramWorkspace/index.js`;
- `tests/telegramWorkspaceManager1Authority.test.js`;
- `tests/telegramWorkspaceManager1AuthorityPostgres.test.js`.

Evidence: `../../evidence/TWM1_4_WORKSPACE_AUTHORITY_VERIFICATION.md`.
Verified implementation gate: HEAD `acd4770cae660a811bb85d64d4ecce961b318c73`, SG 2.1 CI #7274 — SUCCESS.

## TWM1.5 — Bot Permission Discovery & Capability Health
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented `TelegramWorkspaceBotCapabilityService` using the existing Telegram Bot API and TWM PostgreSQL permission snapshot store.

Verification sequence:

```text
workspace_id
→ workspace Telegram chat locator
→ bot id from config or cached getMe
→ live getChatMember for SG bot
→ normalized membership + permission fields
→ bounded Telegram capability map
→ telegram_workspace_bot_permissions snapshot + TTL
→ healthy / degraded / disconnected / verification-failed
→ checkCapabilities / requireCapabilities
```

The capability map covers message send/edit/delete/pin, member restrict/invite, chat/topic management, channel post, poll send and media send. Normal reads may reuse only an unexpired snapshot. Protected checks default to live verification. Missing permission is explicit degraded health with `missingCapabilities` and `missingPermissions`; bot removal is disconnected; live Telegram verification failure is fail-closed and cannot silently reuse stale healthy evidence for a protected operation. `requireCapabilities()` throws a structured capability error instead of allowing false success.

Production wiring reuses `createPostgresTelegramUpdateStore(...).workspaceRegistry.store` and the same `TelegramBotApiClient`; when `TELEGRAM_BOT_USER_ID` is absent, `getMe` resolves the bot identity without adding a required environment setting. No second Telegram transport, credential path, permission database or authorization system exists.

Acceptance passed:
- actual administrator permissions map deterministically;
- missing delete/post/etc. permission produces explicit degraded result;
- guarded operation cannot claim success without required permission;
- disconnected bot is denied;
- channel post requires actual `can_post_messages`;
- fresh cache is reused only inside TTL and stale evidence refreshes;
- Telegram API failure does not trust stale healthy state for a fresh protected check;
- bot identity is resolved once through `getMe` when needed;
- multiple workspaces remain isolated;
- PostgreSQL close/reopen preserves snapshots;
- post-restart fresh verification can downgrade previously stored capability state.

Implementation/tests:
- `src/telegramWorkspace/telegramWorkspaceBotCapabilityService.js`;
- `src/telegramWorkspace/index.js`;
- `src/telegram/telegramBotApiClient.js`;
- `src/runtime/renderWebApplication.js`;
- `tests/telegramWorkspaceManager1BotCapability.test.js`;
- `tests/telegramWorkspaceManager1BotCapabilityPostgres.test.js`.

Evidence: `../../evidence/TWM1_5_BOT_PERMISSION_DISCOVERY_CAPABILITY_HEALTH.md`.
Verified implementation gate: HEAD `d5d4ebdc68f066ac69877e00cad4db84484fb84b`, SG 2.1 CI #7281 — SUCCESS.

## TWM1.6 — Workspace Configuration Service
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented the single TWM workspace-configuration mutation service. Mutation sequence after TWM1.7 convergence:

```text
request / structured proposal
→ exact workspace + namespace
→ bounded schema/value/secret validation
→ fresh workspace authority evaluation
→ service-derived risk classification
→ canonical ActionRequest / SG Action Gate
→ atomic expected-version write after allow only
→ append-only history
→ metadata-only audit / Internal Event Bus
```

Reads require `workspace:view`. Mutations use `workspace:configure` with fresh authority verification. Stale proposals fail closed through the TWM1.2 optimistic version guard. Rollback writes a new version and never erases prior history. TWM1.6 determines risk; TWM1.7 ensures that this risk cannot weaken the canonical SG protected-action confirmation floor.

Production wiring composes `WorkspaceConfigurationService` from the same PostgreSQL workspace store and existing `TelegramWorkspaceAuthorityResolver`; no second config persistence or authority path exists. Boundary tests scan application code and enforce that the service is the sole `workspaceStore.setConfig(...)` owner and that direct SQL config mutation remains confined to `PostgresTelegramWorkspaceStore`.

Acceptance passed:
- canonical nine TWM1.6 namespaces are explicit and bounded;
- `content`, `polls`, `media` remain reserved for later stages;
- schema/value/secret validation fails closed;
- unauthorized users and proposal actor mismatches cannot write;
- stale proposals cannot overwrite newer versions;
- history and rollback preserve the version chain;
- PostgreSQL restart continuity passes;
- multiple workspaces remain isolated;
- production composition uses existing PostgreSQL, Resource Authority, Internal Event Bus and Observability boundaries;
- transport/UI/AI application paths have no direct workspace-config write owner.

Implementation/tests:
- `src/telegramWorkspace/workspaceConfigurationService.js`;
- `src/telegramWorkspace/index.js`;
- `src/runtime/renderWebApplication.js`;
- `tests/telegramWorkspaceManager1Configuration.test.js`;
- `tests/telegramWorkspaceManager1ConfigurationPostgres.test.js`;
- `tests/telegramWorkspaceManager1ConfigurationBoundary.test.js`.

Evidence: `../../evidence/TWM1_6_WORKSPACE_CONFIGURATION_SERVICE.md`.
Verified implementation gate: HEAD `7a36c708f916d1ae375d238b22416bd5cd86a5fa`, SG 2.1 CI #7293 — SUCCESS.

## TWM1.7 — Action Gate Integration
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

All workspace-configuration state changes now converge on the canonical SG protected mutation boundary:

```text
request / proposal
→ canonical actor + exact workspace
→ bounded validation
→ fresh workspace:configure authority
→ service-derived risk
→ canonical ActionRequest
→ existing SG Action Gate
→ request-bound confirmation + idempotency
→ allow only
→ atomic config/history write
→ metadata-only audit/event
```

Implementation rules now enforced:
- `WorkspaceConfigurationService` requires a mutation gate and cannot silently fall back to direct writes;
- `apply`, proposal application and rollback invoke `mutationGate.evaluateMutation()` before persistence;
- `TelegramWorkspaceActionGateIntegration` uses canonical `createActionRequest` and the existing production `harness.actionGate`;
- ActionRequest is bound to canonical actor, project/workspace scope, `workspace:configure`, exact Resource Authority evidence, operation, risk, trace/request ids and idempotency key;
- non-`allow` outcomes fail closed;
- request-bound confirmation is authoritative; caller/user/model booleans are not execution authority;
- TWM risk may tighten but never weaken global SG confirmation/security policy;
- replay cannot authorize a second write;
- rollback is a distinct protected state-changing request;
- authority denial occurs before gate/persistence;
- no second Action Gate, identity, Resource Authority or config persistence stack exists.

Production composition is guarded: only a Render harness with canonical Resource Authority registry/access context composes the TWM authority/config runtime, and that real runtime then requires canonical `actionGate.evaluate`. Minimal non-TWM test/runtime harnesses remain compatible and cannot accidentally instantiate a partial TWM write path.

Acceptance passed:
- unconfirmed/denied mutation writes nothing;
- confirmed request-bound mutation writes exactly once;
- replay is rejected before a second config write;
- high/service-derived risk cannot be caller-downgraded;
- rollback is separately gated and durable;
- PostgreSQL restart preserves confirmed apply/rollback history;
- production wiring uses the same SG Action Gate;
- boundary test proves one internally gated application config-write owner;
- full SG 2.1 CI passes.

Implementation/tests:
- `src/telegramWorkspace/telegramWorkspaceActionGateIntegration.js`;
- `src/telegramWorkspace/workspaceConfigurationService.js`;
- `src/telegramWorkspace/index.js`;
- `src/runtime/renderWebApplication.js`;
- `tests/telegramWorkspaceManager1ActionGate.test.js`;
- `tests/telegramWorkspaceManager1ActionGatePostgres.test.js`;
- `tests/telegramWorkspaceManager1ConfigurationBoundary.test.js`.

Evidence: `../../evidence/TWM1_7_DECISION_ACTION_GATE_INTEGRATION.md`.
Verified code/runtime gate: HEAD `747a821de5a4fd19be766e0583e005b6ee8e38c0`, SG 2.1 CI #7307 — SUCCESS.

TWM1.8 and TWM1.9 are now CLOSED and both converge on this same protected backend path. TWM1.10 is next and must wire persisted effective configuration into real Telegram runtime behavior.

## TWM1.8 — Telegram Native UI & Setup Wizard
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Implemented inline keyboard UI as a presentation/controller layer only. UI callbacks carry bounded identifiers and never encode authority. Identity, scope and authorization are re-resolved server-side for every protected mutation.

Implemented acceptance includes:
- authority-filtered workspace list/select;
- connect instructions;
- progressive setup wizard;
- response/moderation/publication and advanced settings;
- members/roles;
- diagnostics/history/rollback;
- preview without mutation;
- explicit request-bound confirmation before apply;
- rollback as a new separately confirmed mutation;
- ordinary non-TWM Telegram messages remain on the existing runtime path.

Evidence: `../../evidence/TWM1_8_TELEGRAM_NATIVE_UI_SETUP_WIZARD.md`.
Verified final gate: HEAD `dda7f2ec3188bb1f9b25cc8951caca484ca8aab6`, SG 2.1 CI #7323 — SUCCESS.

## TWM1.9 — Natural-Language Configuration
**Status: CLOSED / IMPLEMENTED / CI-VERIFIED.**

Natural-language configuration is implemented through the existing AI Router as bounded interpretation only. Model output is data-only and cannot grant authority or mutate storage.

Implemented workflow:

```text
ordinary Telegram request
→ existing invocation boundary
→ canonical identity
→ authority-filtered workspaces / exact chat scope
→ AI Router strict bounded structure
→ deterministic workspace resolution + patch validation
→ TWM1.6 proposal/current-config merge
→ durable actor-bound TTL pending action
→ explicit Telegram confirmation
→ exact stored proposal + original request id
→ TWM1.7 Action Gate
→ atomic config/history write
```

Private ambiguity asks for workspace selection rather than guessing. Explicit group/supergroup/channel scope is authoritative. Cross-workspace model redirection is rejected. Classification failure or `not-twm` passes the original message to ordinary SG runtime; protected `twm19` callbacks fail closed. History queries use stored deterministic config history.

Evidence: `../../evidence/TWM1_9_NATURAL_LANGUAGE_CONFIGURATION.md`.
Verified final closure: HEAD `c5da8de6aa87489e0423b512920cf3a0875037f9`, SG 2.1 CI #7347 — SUCCESS.

## TWM1.10 — Runtime Wiring
**Status: NEXT / PLANNED.**

Make Telegram runtime consume effective workspace configuration through an approved read interface. Configuration reads must be bounded/cached safely and invalidate predictably after writes.

Acceptance: real runtime response/moderation/publication behavior changes after config mutation and persists across restart.

## TWM1.11 — Audit, Rollback, Diagnostics
**Status: PLANNED.**

Expose history and rollback through authorized services. Rollback creates a new version and audit record; it does not delete history. Diagnostics are read-only and secret-safe.

Acceptance: SG can identify actor/time/before/after and restore a permitted prior version while retaining full audit chain.

## TWM1.12 — Production E2E & Live Acceptance
**Status: PLANNED.**

Use real Telegram group and channel acceptance with at least two human authority levels and two independent workspaces.

Required group scenario:

```text
new user
→ add SG
→ discover
→ verify admin authority
→ verify bot permissions
→ wizard setup
→ config mutation
→ runtime behavior proves mutation
→ restart
→ persisted behavior remains
→ member mutation denied
→ admin mutation allowed
→ admin rights revoked in Telegram
→ new mutation denied
→ second workspace unchanged
→ audit/history verified
```

Required channel scenario covers connect/authority, post-related bot permissions, configuration, publication policy behavior, restart and unauthorized denial.

CI may prove code/test behavior but cannot substitute for claims requiring real Telegram/live evidence.

## TWM1.13 — Telegram Mini App
Only after TWM1.12. Reuse the same backend APIs/services. Authenticate Telegram Mini App init data server-side and map it back through existing identity/authority boundaries. No separate business rules.

Acceptance: Mini App and chat/inline paths produce equivalent authorization/configuration semantics.

## TWM1.14 — Content, Polls, Quizzes & Media Management
Implement as a functional extension over the already established workspace/authority/configuration/runtime boundaries. Do not create a parallel publication, identity or authorization system.

Implementation sequence:

```text
content/media/poll/test contracts
→ workspace-scoped persistence
→ Telegram API capability extensions where required
→ WorkspaceContentService
→ PollQuizManager / QuizTestSessionManager
→ WorkspaceMediaManager
→ result-event ingestion + idempotent deduplication
→ deterministic WorkspaceStatisticsEngine
→ AI Router result-analysis adapter
→ durable scheduling integration
→ Action Gate + authority revalidation
→ Telegram native UI/natural-language integration
→ restart/replay tests
→ real Telegram live acceptance
```

Required behaviors:
- authorized user can create a text draft and publish it;
- authorized user can publish a photo/video/document supplied to SG;
- authorized user can create a Telegram poll;
- authorized user can create a quiz-mode poll with correct-answer semantics where supported;
- SG can manage a bounded multi-question test session and score structured answers deterministically;
- user can schedule content using the existing durable scheduler rather than a second scheduler;
- scheduled execution revalidates current authority/bot capability where policy requires it;
- Telegram result updates are normalized and deduplicated so replay/restart cannot double count;
- numeric vote totals, percentages, participant/result cardinality and scores come only from deterministic code over structured evidence;
- optional AI analysis receives a bounded immutable result snapshot through AI Router and cannot alter stored totals/scores;
- anonymous Telegram polls remain aggregate-only and are never deanonymized;
- media provenance and workspace scope are preserved;
- media/content/results from Workspace A cannot be reused/read in Workspace B without explicit allowed scope.

Required live acceptance scenario:

```text
authorized workspace admin
→ supplies photo/video
→ SG creates draft
→ preview/confirmation where required
→ publication succeeds
→ create poll/quiz
→ participants respond
→ result updates arrive
→ deterministic statistics computed
→ restart/replay
→ counts remain unchanged
→ AI Router produces bounded interpretation of the deterministic snapshot
→ schedule another content item
→ execution-time authority/capability rechecked
→ unauthorized member publication/result access denied
→ second workspace remains isolated
```

Acceptance must also cover Telegram API failure/missing permission, poll closure where supported, scheduled-action cancellation/idempotency and secret/privacy-safe observability.

## TWM1.15 — Community Operations, Engagement & Analytics
TWM1.15 is implemented as a separate functional extension over the same TWM backend. Canonical substage sequence:

```text
TWM1.15.1 Domain Contracts & Scope
→ TWM1.15.2 PostgreSQL Persistence
→ TWM1.15.3 Forms, Surveys & Feedback
→ TWM1.15.4 Events, Registration & Participation
→ TWM1.15.5 FAQ, Knowledge & Onboarding
→ TWM1.15.6 Community Assistance & Moderation Workflows
→ TWM1.15.7 Cases, Requests & Operator Queues
→ TWM1.15.8 Tasks, Reminders & Decisions
→ TWM1.15.9 Content Planning & Recurring Rubrics
→ TWM1.15.10 Discussion Summaries & Unanswered Questions
→ TWM1.15.11 Deterministic Workspace Analytics
→ TWM1.15.12 Owner Briefs, Reports & Exports
→ TWM1.15.13 Production E2E & Live Acceptance
```

Mandatory implementation rule:

```text
reuse existing SG primitive first
→ add only missing workspace-scoped state/service
→ deterministic state transition/metric logic
→ authority/privacy/Action Gate
→ Telegram/runtime integration
→ tests/replay/restart
→ live evidence
```

TWM1.15 must reuse Memory 2.0, Session/Conversation Context, the existing task/capability system, Durable Automation/Scheduler, Delivery Router, AI Router and Observability. It must not create duplicate memory/task/scheduler systems.

Required live acceptance includes forms/submissions, event registration/waitlist, FAQ/onboarding, case lifecycle, bounded discussion summary, explicit decision confirmation with optional controlled Group Shared Memory promotion, task/reminder creation, content plan/recurring publication, deterministic analytics snapshot, restart/replay, owner brief/export, unauthorized denial and second-workspace isolation.

Detailed procedure: `TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_WORKFLOW.md`.
Roadmap: `../roadmap/TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_PROGRAM.md`.
Architecture: `../architecture/TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS.md`.

## Test layers
Each stage should use the appropriate combination of:
- unit contract/service tests;
- PostgreSQL integration tests;
- Telegram adapter/API contract tests;
- security/authority regression tests;
- runtime integration tests;
- E2E tests;
- replay/idempotency tests;
- deterministic statistics fixtures for TWM1.14/TWM1.15 analytics;
- real live Telegram acceptance for production claims.

## Required invariants
Throughout all stages:
- canonical human root remains `global_user_id`;
- canonical workspace root remains SG-issued `workspace_id`;
- Telegram IDs are platform locators only;
- Resource Authority remains authoritative for concrete-resource control;
- Action Gate remains authoritative for protected execution;
- AI Router is the only model path;
- AI output is never authority or direct mutation;
- AI is not the numeric source of poll/test/workspace analytics results;
- workspace memory/settings/members/media/content/results/forms/cases/feedback/analytics/audit never cross scopes by default;
- bot/user authority can be revoked and re-verified;
- scheduled external actions do not inherit permanent authority from task-creation time;
- anonymous poll/form semantics must match actual evidence/storage behavior;
- operational records do not become confirmed Memory 2.0 facts automatically;
- poll/test outcomes do not become binding decisions automatically;
- secrets never enter ordinary config/content/history/model context;
- UI convenience cannot weaken backend security.

## Documentation synchronization
After every CLOSED stage, synchronize:
- architecture status/evidence where material;
- `TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md`;
- this workflow if acceptance procedure changes;
- TWM1.15 dedicated architecture/roadmap/workflow when applicable;
- canonical indexes where status/order references change;
- implementation/test paths and CI evidence.

## Final closure rule
TWM1.1–TWM1.12 are CLOSED only after the full multi-user, multi-workspace real Telegram acceptance passes. TWM1.13 remains a separately closable optional rich-UI extension. TWM1.14 remains a separately closable content/polls/quizzes/media extension. TWM1.15 remains a separately closable Community Operations, Engagement & Analytics extension and requires TWM1.15.1–TWM1.15.13 code, CI and real Telegram live acceptance before CLOSED.