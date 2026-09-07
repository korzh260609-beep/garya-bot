# SG 2.2 — Full OpenClaw Capability Inheritance

## Status
CANONICAL GLOBAL RULE / MANDATORY ROADMAP GATE

## Rule
The SG entity above OpenClaw must be able to use the full standard OpenClaw capability surface available in the active environment.

This is not a manually maintained SG whitelist and is not limited to capabilities explicitly named in the SG roadmap.

All current and future standard OpenClaw capabilities are considered available to SG when they are:
- present in the deployed OpenClaw version;
- installed/configured where required;
- technically usable in the deployment environment;
- permitted by authoritative credentials, permissions, security, approvals, sandboxing, pairing and policy.

## Mandatory roadmap interpretation
Every SG 2.2 work item must be interpreted in this order:

```text
What OpenClaw already provides
        ↓
Make that capability usable by the SG entity
        ↓
Add only missing SG-specific semantics/domain behavior
```

The roadmap must never be interpreted as:

```text
Take the SG 2.1 subsystem
        ↓
rebuild/port it beside OpenClaw
```

For Points 5–16 in particular, the default task type is **OpenClaw capability audit + SG semantic/domain overlay**, not development of a replacement subsystem.

## No artificial narrowing
SG-specific code must not create a separate allowlist that exposes only selected OpenClaw capabilities.

SG-specific code must not silently reduce, shadow, fork, replace or disable standard OpenClaw capability availability.

A capability may be unavailable only because of a real boundary:
- missing or insufficient credentials/permissions;
- OpenClaw security, approval, sandboxing, pairing or access policy;
- deployment/platform limitation;
- capability not installed/configured;
- technical unavailability;
- explicit owner restriction.

## Capability scope
This rule includes, but is not limited to:
- agents and agent lifecycle;
- tools, skills and plugins;
- channels, sessions and routing;
- browser, web, files and media;
- nodes and device-local actions;
- memory and search;
- tasks, schedules and automations;
- model providers and model selection;
- workspace and shell;
- Git, GitHub and repository-development tooling;
- diagnostics and observability;
- future capabilities introduced by OpenClaw.

## Work-list mapping
The canonical SG 2.2 list must be understood as follows:

1. **OpenClaw foundation** — preserve clean OpenClaw as the technical base.
2. **SG entity** — create the SG entity above OpenClaw; this is the beginning of Project SG itself.
3. **Identity / Global ID / roles** — add SG identity/profile semantics on top of OpenClaw identity, not a second identity runtime.
3A. **Telegram test runtime** — expose the SG entity through OpenClaw Telegram, not through a new SG transport.
4. **GitHub/repository access** — let SG use OpenClaw's complete permitted Git/GitHub/development capabilities, not a special SG GitHub subsystem.
5. **Memory 2.0** — audit and use OpenClaw memory first; add only SG lifecycle/isolation/metadata semantics that are missing.
6. **Project Memory 3.0** — add SG project-memory semantics above OpenClaw memory/workspace, not a separate Project Memory platform.
7. **PDK4** — add SG durable development-knowledge semantics above OpenClaw development/Git capabilities, not a second development runtime.
8. **Historical & Semantic Search** — extend OpenClaw memory search only for SG-specific historical semantics that are missing.
9. **Canonical Semantic Model** — add SG semantic normalization above the OpenClaw agent/dispatch lifecycle, not another agent loop or dispatcher.
10. **Action Gate** — express SG-specific risk/confirmation semantics through OpenClaw security/approval mechanisms, not a second permission engine.
11. **AI policy/cost** — use OpenClaw provider/model/auth/routing capabilities and add only SG quality/cost policy and accounting semantics where missing.
12. **Tasks/Automation** — use OpenClaw tasks/automations as authoritative; add SG ownership/semantics/presentation only where missing.
13. **Channels** — the same SG entity must operate through all permitted OpenClaw channels; do not create SG channel runtimes.
14. **Sources** — use OpenClaw web/browser/file/provider tools; add only SG source-management semantics where required.
15. **Groups/users/subscriptions** — use OpenClaw channel/access identity mechanisms;
    follow `pillars/roadmap/SG22_ROLE_MODEL_MIGRATION_PLAN.md` for automatic citizenship,
    Global-ID personal workspaces and removal of parallel SG group roles.
16. **Observability** — use OpenClaw diagnostics/telemetry and add only SG-specific events/metrics/audit records where required.
17. **Authority/duplication audit** — verify both that no duplicate SG platform systems exist and that SG has not lost any permitted OpenClaw capability.
18. **Full verification** — verify SG behavior plus full permitted OpenClaw capability inheritance at the exact tested commit.

## Future compatibility
When OpenClaw gains a new standard capability, SG should inherit its usability through the same general OpenClaw capability surface without requiring a dedicated SG runtime or a new parallel implementation.

A new SG roadmap block is required only when SG-specific semantics, policy, domain state or presentation must be added above that OpenClaw capability.

## Implementation rule
For every SG 2.2 block:
1. Audit OpenClaw first.
2. Reuse the native capability when it exists.
3. Make that native capability usable by the SG entity.
4. Keep the standard OpenClaw capability range available to SG.
5. Add only missing SG-specific semantics.
6. Do not create a duplicate subsystem.
7. Do not close a block if SG-specific wiring unnecessarily narrows OpenClaw.

## Closure gate
No SG 2.2 block may be CLOSED unless all are true:
- the relevant OpenClaw capability was audited;
- adequate OpenClaw capability remains authoritative;
- SG can use the permitted native capability;
- only missing SG-specific semantics were added;
- no parallel replacement subsystem remains;
- SG-specific wiring did not artificially reduce the standard OpenClaw capability surface.

## Owner-approved activation plan

### Goal
Activate the maximum OpenClaw capability surface that is technically usable in the SG 2.2 deployment, in this strict priority order:

1. SG/OpenClaw access to GitHub and Render.
2. Full operation through Telegram.
3. Full durable memory with correct user isolation.
4. Remaining OpenClaw tools, skills and plugins.

This plan records intended work only. A phase is not implemented, verified or closed merely because it appears here.

### Fixed authority and delivery rules

- The monarch is the sole SG and OpenClaw owner and receives the complete configured capability surface.
- Citizens receive normal SG capabilities, including browser, search, memory, messages, files, media, voice, tests and polls when available.
- Citizens must not receive project-development or infrastructure authority: repository mutation, GitHub administration, Render administration, server shell/process access, secrets, environment variables or OpenClaw configuration.
- These are sender-specific authority boundaries, not a global reduction of SG capabilities.
- Work remains on `dev/sg2.2-openclaw`; `main` is not changed.
- Render autodeploy remains disabled. Deploy capability may be configured, but an actual deploy requires the owner's explicit command.
- OpenClaw core and the bundled Telegram adapter remain unchanged.
- Missing SG-specific behavior belongs in the external SG plugin only.
- Each implementation step follows: current facts -> failing contract test -> implementation -> local proof -> diff review -> commit -> push -> owner-run Render deploy -> live verification.

### Phase 0 — exact baseline and rollback point

1. Confirm the active checkout, branch, local HEAD, remote HEAD and clean worktree.
2. Record the exact deployed Render image and source commit.
3. Record the effective OpenClaw configuration after startup, not only the template configuration.
4. Inventory every standard tool, skill and plugin as:
   - active and usable;
   - installed but disabled;
   - missing from the image;
   - awaiting credentials;
   - awaiting account or device pairing;
   - unsupported by the deployment platform.
5. Record current GitHub, Render, Telegram, session and memory behavior without changing production state.
6. Create an exact rollback reference before implementation begins.

Phase 0 output is a dated capability matrix. Capability counts are observations tied to the audited OpenClaw version, not permanent constants.

### Phase 1 — contracts before activation

Add failing contract coverage proving the intended boundaries before configuration or runtime changes:

1. The effective startup profile must be `full`.
2. Required browser runtime dependencies must exist in the built image.
3. The monarch must receive GitHub, Render and development tools.
4. A citizen must not receive GitHub, Render, server, secret, environment or OpenClaw-administration tools.
5. A citizen must retain ordinary non-administrative SG capabilities.
6. A citizen must not read another user's direct-message session or private memory.
7. Startup and restart must preserve the same capability policy.

Tests must protect behavior and authority boundaries rather than merely search configuration text.

## Priority 1 — GitHub and Render

### Phase 2 — activate the complete OpenClaw tool profile

1. Change the SG deployment from the restricted `coding` profile to `full`.
2. Update the startup normalization path so persisted configuration cannot silently restore `coding` on restart.
3. Install the Chromium runtime required by the standard browser tool in the Render image.
4. Verify the effective tool inventory after a cold start.
5. Keep owner-only OpenClaw restrictions authoritative where OpenClaw already provides them.
6. Keep the SG sender policy limited to SG-specific identity mapping and the citizen infrastructure boundary; do not add a new global SG allowlist.

### Phase 3 — complete GitHub authority for the monarch

1. Audit the existing GitHub integration and authentication flow first; do not create a parallel GitHub subsystem.
2. Select one authoritative credential method that covers all repositories and organizations the owner's account permits SG to manage.
3. Prefer an installed GitHub App covering all repositories when it supports the required operations. If it cannot provide an owner-required operation, replace the credential method with an adequate user-authorized token instead of operating two competing integrations.
4. Grant the permissions required for the full owner workflow:
   - repository discovery and search;
   - public and private repository reads;
   - branches, commits and pushes;
   - pull requests and reviews;
   - issues and projects;
   - Actions, workflows, checks and logs;
   - releases;
   - repository settings and administration when explicitly requested.
5. Store credentials only in the supported Render/OpenClaw secret store. Never place credential values in Git, logs, prompts, chat transcripts or memory.
6. Bind privileged GitHub tools to the monarch identity derived from the immutable Telegram sender identifier.
7. Preserve the project rule that SG work in this repository targets `dev/sg2.2-openclaw`, never `main`.

#### GitHub verification

Use a dedicated test repository or an owner-approved temporary branch:

1. Resolve the authenticated GitHub identity.
2. List all expected public and private repositories.
3. Read repository contents and history.
4. Create and push a temporary branch and commit.
5. Open a pull request.
6. Run and inspect a GitHub Actions workflow.
7. Read checks, logs, issues and releases.
8. Remove temporary test artifacts only with owner approval.
9. Repeat the access attempt as a citizen and prove it is denied.

### Phase 4 — complete Render authority for the monarch

1. Audit available native OpenClaw plugins and maintained integrations first.
2. If no adequate native Render integration exists, add only a thin Render API tool surface in the external SG plugin.
3. Configure secret references for the Render API key, workspace identifier and SG service identifier.
4. Provide monarch capabilities to:
   - list services and inspect service configuration;
   - identify the deployed image and source commit;
   - list deploys and inspect their state;
   - read build and runtime logs;
   - read metrics and resource usage;
   - start a deploy for an exact commit;
   - cancel a running deploy;
   - restart or roll back a service;
   - list environment-variable names with values redacted;
   - add or update one environment variable;
   - validate deployment configuration before applying it.
5. Do not use Render's replace-all environment-variable operation for routine single-key updates because omitted keys are deleted.
6. Return redacted, useful tool results to SG without exposing credentials.
7. Keep Render tools unavailable to citizens.

#### Render verification

1. Read service and deploy state without mutation.
2. Confirm deployed image and source commit.
3. Read bounded build and runtime logs.
4. Prove environment-variable values remain redacted.
5. Perform a reversible environment-variable write only after separate owner approval.
6. Trigger, observe, cancel or roll back a deploy only after separate owner approval.
7. Prove the same operations are unavailable to a citizen.

## Priority 2 — full Telegram operation

### Phase 5 — expose standard capabilities through Telegram

Use the existing OpenClaw Telegram channel and external SG plugin seams. Do not modify or fork the Telegram adapter.

1. Verify direct-message operation with `per-channel-peer` session separation.
2. Verify groups with the existing mention policy.
3. Verify replies and quoting.
4. Verify inbound and outbound text, images, documents, audio, voice and video where supported by Telegram and the current adapter.
5. Verify reactions, inline buttons, polls and WSP6 interactive tests.
6. Verify topics/threads when the target group uses them.
7. Verify supported message editing and deletion behavior.
8. Verify scheduled Telegram delivery through authoritative OpenClaw automation support.
9. Activate and verify TTS delivery.
10. Verify browser, search, file and media results can be requested and returned through Telegram.
11. Verify one Global ID and personal workspace follow a person between direct messages and groups without leaking private data into a group.

### Phase 6 — Telegram authority and session proof

1. Resolve monarch/citizen identity only from the immutable Telegram sender identifier.
2. Keep direct-message sessions isolated by channel and peer.
3. Keep a group conversation shared only inside that group.
4. Prove session listing, history, search and send operations cannot expose the monarch's direct-message session to a citizen.
5. Prove the monarch retains the complete configured OpenClaw capability surface in both direct messages and groups.
6. Prove a citizen retains ordinary SG capabilities without acquiring development or infrastructure authority.

## Priority 3 — full durable memory

### Phase 7 — define authoritative memory scopes

Treat these as separate scopes:

1. Session history: messages belonging to one OpenClaw session.
2. Personal memory: durable facts, preferences and unfinished work belonging to one Global ID.
3. Resource memory: durable knowledge belonging to an explicit group/workspace resource.
4. Monarch project memory: SG decisions, architecture, status and development knowledge available only to the monarch.

The existing OpenClaw workspace memory must not remain an accidental shared personal-memory store.

### Phase 8 — bind native memory to SG identity

1. Audit native OpenClaw memory, indexing and search before adding SG code.
2. Make the real authoritative memory scope follow Global ID; a path printed in context without storage/index routing does not satisfy this requirement.
3. Use OpenClaw's canonical current storage model. Do not add new JSON or sidecar runtime state.
4. Add only the missing SG scope selection, lifecycle and metadata semantics through the external SG plugin.
5. Route native memory search and retrieval to the caller's authorized personal, resource and project scopes.
6. Prevent a group response from revealing another participant's private memory.
7. Keep secrets and raw GitHub/Render credentials outside all memory scopes.
8. Rebuild indexes from authoritative stored memory when required; do not treat an index as the sole copy.

### Phase 9 — complete memory behavior

SG must be able to:

1. Save a durable fact on explicit request.
2. Retrieve it after a new session, restart and deployment.
3. Retain project decisions and unfinished tasks.
4. Use relevant preferences without mixing users.
5. Show what was saved and where it is scoped.
6. Correct an inaccurate memory.
7. Forget a selected memory.
8. Export authorized memory.
9. Restore or rebuild the search index.
10. Preserve important durable facts before session compaction when native OpenClaw lifecycle support permits it.

Session compaction and durable memory are separate systems; successful compaction does not prove durable recall.

### Phase 10 — persistence and isolation verification

1. Verify the authoritative memory database and artifacts reside on persistent Render storage.
2. Verify recall after process restart, cold deploy, `/new`, channel change and context compaction.
3. Verify the same Global ID receives the same personal memory across authorized transports.
4. Verify a different Global ID cannot search, retrieve, infer, edit or delete that memory.
5. Verify group/resource memory follows explicit membership and resource authority.
6. Verify backup and recovery without recording secrets.

## Priority 4 — remaining OpenClaw capabilities

### Phase 11 — activate every applicable remaining capability

For every tool, skill and plugin in the exact deployed OpenClaw version:

1. Activate capabilities that work without additional dependencies.
2. Install compatible free runtime dependencies required by standard tools.
3. Record required credentials or external accounts without inventing or purchasing them.
4. Record required device/node pairing.
5. Prefer an existing maintained OpenClaw plugin over custom SG implementation.
6. Avoid duplicate integrations that provide the same authority through competing paths.
7. Record platform-incompatible capabilities with the exact blocker.
8. Bind genuinely destructive or administrative capabilities to the monarch without reducing ordinary citizen features.

Installing every manifest blindly is not closure. A capability counts as active only when its real user flow works in the deployed environment.

### Phase 12 — final exact-commit proof

The activation program is complete only when all of the following are proven at the same commit:

- the effective profile remains `full` after a cold start;
- the browser launches and completes a real navigation task;
- the monarch completes the verified GitHub workflow across the intended repository scope;
- the monarch can inspect Render and perform each separately approved administrative operation;
- Telegram text, supported media, buttons, polls, voice, scheduling, browser and memory flows work;
- personal memory survives restart/deploy/channel changes and remains isolated;
- citizens retain normal SG functions and cannot affect code, infrastructure, secrets or platform settings;
- OpenClaw core and the bundled Telegram adapter have not changed;
- SG-specific behavior remains in the external plugin;
- relevant local tests, build checks, exact-head CI and post-deploy live checks pass;
- the rollback point remains usable.

### Execution checkpoints

Each checkpoint requires the owner's explicit authorization before the next mutation:

1. Read-only baseline audit.
2. Failing contract tests.
3. Implementation for one approved phase.
4. Local verification and diff review.
5. Commit.
6. Push to `dev/sg2.2-openclaw`.
7. Owner-triggered Render deployment.
8. Render log inspection and live Telegram verification.

## Relation to SG 2.2 project
Project SG 2.2 is the creation and evolution of the SG entity above OpenClaw. OpenClaw remains the platform; the SG entity uses the platform's complete permitted capability surface and adds only what makes the system SG.
