# TWM1.8 — Telegram Native UI & Setup Wizard Workflow

## Status
IMPLEMENTED / CI-VERIFIED code gate; final closure requires green CI on the documentation-synchronized HEAD.

## Workspace selection

```text
user → /workspaces in SG private chat
→ resolve Telegram identity to canonical global_user_id
→ list bounded known Telegram workspaces
→ verify workspace:view for each candidate
→ show only authorized groups/channels
→ user selects one workspace
→ reverify exact workspace before displaying management UI
```

## First setup

```text
workspace menu
→ Quick setup
→ choose response mode / baseline moderation / publication preview
→ preview screen
→ fresh workspace:configure authority
→ explicit Confirm button
→ WorkspaceConfigurationService.applyChange
→ canonical ActionRequest
→ existing SG Action Gate
→ request-bound confirmation + idempotency
→ atomic PostgreSQL config/history write
→ success screen with resulting version
```

No JSON, `.env`, code or database access is required.

## Advanced settings
The user opens an Advanced menu only when needed, then selects memory, AI, automation or notifications. Members/roles remain a separate high-risk section. All settings converge on the same configuration service and Action Gate.

## History and rollback

```text
workspace → History
→ authorized config namespace list
→ bounded version history
→ choose historical version
→ rollback preview
→ second explicit callback confirmation
→ WorkspaceConfigurationService.rollback
→ fresh authority + Action Gate
→ append a new version
```

History is never rewritten or deleted by rollback.

## Diagnostics

```text
workspace → Diagnostics
→ fresh workspace:view authority
→ fresh bot permission/capability health
→ show bounded role/health/missing-permission information
```

## Callback safety
All TWM callbacks are namespaced under `twm|`. The selected workspace id is treated only as an input locator and is re-authorized. It never grants scope. Preview callbacks cannot write state. Apply/rollback callbacks bind confirmation to the current Telegram callback query id.

## Ordinary conversation isolation
Messages that are not TWM commands/callbacks continue unchanged into the existing Telegram invocation and SG Semantic Kernel/runtime path. TWM1.8 does not introduce keyword-based natural-language configuration; that belongs to TWM1.9.
