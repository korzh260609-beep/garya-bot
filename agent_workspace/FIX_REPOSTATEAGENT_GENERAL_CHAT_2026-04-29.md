# Fix: RepoStateAgent detached from general chat

Date: 2026-04-29
Branch: main

## Problem

RepoStateAgent / Human Mode dry-run was being executed from `src/core/handleMessage.js` during ordinary message handling.

This caused normal user messages such as `кто я?`, `кто ты?`, and `привет` to be intercepted by project/repository logic.

That violated the intended boundary:

```text
RepoStateAgent = repository/project-map and semantic-map facts provider only.
RepoStateAgent must not be a general chat responder.
```

## Confirmed intended boundary

RepoStateAgent may be used only for explicit repository/project-map work:

- repository structure;
- project map;
- semantic map of project modules;
- repository diagnostics through explicit commands or future gated flow.

RepoStateAgent must not handle:

- ordinary dialogue;
- user identity questions;
- SG personality/persona questions;
- memory questions;
- non-repository tasks.

## Fix applied

File changed:

- `src/core/handleMessage.js`

Changes:

1. Removed Human Mode / RepoStateAgent dry-run imports from general message flow.
2. Removed `runHumanModeProjectRepoDryRunHook` and related timeout helper from `handleMessage.js`.
3. Removed automatic call to `handleHumanProjectIntent` before command/chat routing.
4. Removed `humanModeProjectRepoDryRun` from shadow result and runtime diagnostics.
5. Left normal routing intact:

```text
command -> handleCommandFlow
ordinary chat -> handleChatFlow
```

## Commits

- `3127bbfc8461c8af38f241f671e0dd6ed3fee1aa` — first emergency fix: stopped sending RepoStateAgent response directly.
- `5dc5b8ddcbfe4a6ffdb203afe341d2f387f1e471` — full fix: detached RepoStateAgent dry-run from general message path.

## Verification

User manually tested Telegram after deploy and reported: `проверил вроде работает`.

Expected behavior:

- `кто я` -> normal chat flow
- `кто ты` -> normal chat flow
- `привет` -> normal chat flow
- no RepoStateAgent text in ordinary chat replies

## Remaining future work

Only after explicit approval:

1. Add a separate controlled entry for RepoStateAgent.
2. Gate it strictly to explicit repository/project-map/semantic-map commands.
3. Keep ordinary dialogue, memory, SG identity, and user identity outside RepoStateAgent.

## Final rule

Do not reconnect RepoStateAgent to general `handleMessage` flow.
RepoStateAgent must remain an internal repository facts provider unless called by an explicit repo/project-map path.
