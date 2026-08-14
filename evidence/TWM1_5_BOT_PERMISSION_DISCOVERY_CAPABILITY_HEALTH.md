# TWM1.5 — Bot Permission Discovery & Capability Health Evidence

## Status
**CLOSED / IMPLEMENTED / CI-VERIFIED.**

## Implementation gate
- branch: `dev/sg2.1-semantic`
- code HEAD: `d5d4ebdc68f066ac69877e00cad4db84484fb84b`
- SG 2.1 CI: **#7281 — SUCCESS**
- CI foundation passed PostgreSQL migration, Block 19 security gate, full `npm run check`, runtime start, worker start and independent diagnostics verification.

## Implemented paths
- `src/telegramWorkspace/telegramWorkspaceBotCapabilityService.js`
- `src/telegramWorkspace/index.js`
- `src/telegram/telegramBotApiClient.js`
- `src/runtime/renderWebApplication.js`
- `tests/telegramWorkspaceManager1BotCapability.test.js`
- `tests/telegramWorkspaceManager1BotCapabilityPostgres.test.js`

## Production composition
TWM1.5 reuses the existing Telegram and PostgreSQL boundaries:

```text
existing Telegram Bot API client
→ getMe when bot id is not configured
→ getChatMember(workspace telegram_chat_id, bot user id)
→ normalize membership + actual Telegram permission fields
→ map into bounded SG Telegram capabilities
→ persist snapshot in telegram_workspace_bot_permissions
→ return healthy / degraded / disconnected / verification-failed health
→ requireCapabilities() fails closed before an operation can claim success
```

No second Telegram transport, bot credential path, persistence stack or permission database is introduced. Render production bootstrap creates the service from the same PostgreSQL workspace registry/store already used by Telegram workspace discovery.

## Capability mapping
The service exposes bounded capability health for:
- `telegram.message.send`;
- `telegram.message.edit`;
- `telegram.message.delete`;
- `telegram.message.pin`;
- `telegram.member.restrict`;
- `telegram.member.invite`;
- `telegram.chat.manage`;
- `telegram.topic.manage`;
- `telegram.channel.post`;
- `telegram.poll.send`;
- `telegram.media.send`.

The persisted snapshot retains Telegram membership status, known boolean permission fields, the derived capability map, `fetched_at` and `expires_at`.

## Freshness and failure behavior
- default snapshot TTL is bounded;
- non-sensitive health reads may reuse an unexpired persisted snapshot;
- `checkCapabilities(... requireFresh=true)` forces a live Telegram re-check;
- `requireCapabilities()` defaults to fresh verification and throws a structured `TelegramWorkspaceBotCapabilityError` when unavailable;
- missing Telegram permission yields `degraded` with explicit `missingCapabilities` and `missingPermissions`;
- bot removal/left state yields `disconnected`;
- live Telegram verification failure yields `verification-failed` and cannot silently reuse stale healthy evidence for a protected operation;
- `getMe` is cached only for bot identity, not as workspace permission evidence.

## Acceptance coverage
Deterministic unit tests prove:
- administrator permission mapping;
- missing permission produces explicit degraded health;
- guarded execution cannot report success when permission is missing;
- disconnected bot is denied;
- channel publishing requires actual `can_post_messages`;
- fresh persisted cache is reused only inside TTL;
- stale cache triggers live refresh;
- live API failure does not trust stale success for protected checks;
- bot id is obtained through `getMe` once when no environment id is supplied;
- independent workspaces never share capability snapshots or decisions.

PostgreSQL integration proves:
- permission snapshots survive close/reopen;
- workspace A and workspace B remain isolated;
- channel and supergroup capability states can differ independently;
- a fresh post-restart Telegram check can downgrade previously persisted permission state;
- persistence continues to use the existing `telegram_workspace_bot_permissions` table.

## Boundaries not claimed
TWM1.5 does **not** claim:
- workspace configuration mutation service (TWM1.6);
- full state-changing Action Gate integration (TWM1.7);
- native setup UI/natural-language configuration;
- runtime consumption of workspace configuration (TWM1.10);
- real Telegram group/channel E2E live acceptance (TWM1.12).

TWM1.5 provides the canonical capability guard API that those later stages must call. A later operation cannot claim successful Telegram execution when its required capability health is unavailable.

Next canonical stage: **TWM1.6 — Workspace Configuration Service**.
