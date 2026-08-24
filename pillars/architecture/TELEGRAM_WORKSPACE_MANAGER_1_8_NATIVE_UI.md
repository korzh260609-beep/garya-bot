# TWM1.8 — Telegram Native UI & Setup Wizard Architecture

## Status
IMPLEMENTED / CI-VERIFIED code gate; final closure follows canonical documentation CI.

## Boundary
TWM1.8 is a presentation/controller layer over the existing TWM1 backend. It does not create a second Telegram transport, identity model, authority model, Action Gate, configuration store or scheduler.

Canonical path:

```text
Telegram webhook
→ durable update claim + existing workspace discovery
→ TWM native-update classifier
→ TelegramWorkspaceNativeUi
→ canonical Telegram Identity Link / global_user_id
→ TelegramWorkspaceAuthorityResolver
→ WorkspaceConfigurationService
→ TelegramWorkspaceActionGateIntegration
→ existing SG Action Gate
→ PostgreSQL atomic config/history write
```

Ordinary natural-language messages remain on the existing Telegram Transport → SG runtime path.

## Native entrypoints
Private-chat commands:
- `/workspace`
- `/workspaces`
- `/sg_workspace`
- `/sg_workspaces`

Inline callbacks use the bounded `twm|...` namespace. Callback payloads are validated against Telegram's 64-byte `callback_data` limit.

## Progressive UI
The first screen shows only authorized workspaces. A workspace screen exposes:
1. Quick setup.
2. Response behavior.
3. Moderation.
4. Publication/channel settings.
5. Advanced settings (memory, AI, automation, notifications).
6. Members/roles.
7. History/rollback and diagnostics.

This prevents a non-technical user from facing one flat configuration matrix.

## Confirmation and mutation ownership
Preview buttons do not write state. A protected mutation requires a second explicit callback click. The callback query id becomes the canonical request id for that UI action:

```text
requestId = twm-ui:<callback_query_id>
confirmation = { confirmed: true, requestId }
```

The UI never calls the PostgreSQL store directly. It invokes only `WorkspaceConfigurationService.applyChange()` or `rollback()`, preserving TWM1.7 Action Gate confirmation, idempotency, fresh authority and optimistic version protection.

## Workspace privacy
Workspace listing starts from the bounded registry but shows an item only after `workspace:view` authority succeeds for the canonical actor. A callback that names another workspace is re-authorized and fails closed before configuration read/write.

## Bot API extensions
The existing Telegram Bot API client now supports:
- inline `reply_markup` on `sendMessage`;
- `editMessageText`;
- `answerCallbackQuery`;
- webhook subscriptions for callback queries, channel posts and bot membership updates in addition to messages.

No separate Telegram client or token path is introduced.

## Production composition
Render composes `TelegramWorkspaceNativeUi` only when the existing TWM configuration runtime exists. It receives the same production identity resolver, workspace registry, authority resolver, configuration service, bot capability service and Bot API client.

Native UI updates are classified before ordinary invocation filtering. With production early acknowledgement enabled, Telegram receives an immediate HTTP 200 while the existing bounded pending-work drain completes UI processing and durable update status.

## Diagnostics
The diagnostics screen performs a fresh workspace authority check and a fresh bot-capability health read where available. It exposes bounded state and missing permissions without secrets.

## Non-goals
TWM1.8 does not implement natural-language configuration (TWM1.9), effective runtime consumption of persisted settings (TWM1.10), full operational diagnostics/audit UX (TWM1.11) or live Telegram acceptance (TWM1.12).
