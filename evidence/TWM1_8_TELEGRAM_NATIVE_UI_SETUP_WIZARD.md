# TWM1.8 — Telegram Native UI & Setup Wizard Evidence

## Scope
TWM1.8 adds an SG-native Telegram inline UI and first-setup wizard over the existing TWM1.1–TWM1.7 backend.

## Implemented code
- `src/telegramWorkspace/telegramWorkspaceNativeUi.js`
- `src/telegramWorkspace/index.js`
- `src/telegram/telegramBotApiClient.js`
- `src/telegram/telegramProductionIntegration.js`
- `src/runtime/renderWebApplication.js`

## Implemented behavior
- private `/workspace` and `/workspaces` entrypoints;
- authority-filtered workspace listing;
- progressive workspace menu and quick setup;
- response, moderation and publication presets;
- advanced memory/AI/automation/notifications controls;
- members/roles section;
- connect instructions;
- bounded diagnostics using fresh authority and bot capability health;
- configuration history and explicit rollback flow;
- two-step preview → confirm mutation flow;
- callback-query request-bound Action Gate confirmation;
- ordinary natural-language Telegram messages remain on the pre-existing SG runtime path;
- callbacks are processed before ordinary invocation filtering;
- production early webhook acknowledgement uses the existing pending-work drain;
- no direct workspace config persistence from the UI.

## Authorization / mutation invariant

```text
UI input
→ canonical global_user_id
→ exact workspace authority
→ WorkspaceConfigurationService
→ TelegramWorkspaceActionGateIntegration
→ SG Action Gate
→ atomic PostgreSQL write/history
```

Preview does not mutate. Apply and rollback bind confirmation to `twm-ui:<callback_query_id>`. Cross-workspace callbacks are re-authorized and fail closed.

## Tests
- `tests/telegramWorkspaceManager1NativeUi.test.js`
  - unauthorized workspaces hidden;
  - progressive menu;
  - preview causes no write;
  - explicit apply carries canonical actor and request-bound confirmation;
  - cross-workspace callback denied before write;
  - rollback requires separate confirmation;
  - ordinary text is not consumed.
- `tests/telegramWorkspaceManager1NativeUiIntegration.test.js`
  - `/workspaces` consumed before SG runtime;
  - TWM callbacks consumed before invocation filtering;
  - ordinary natural-language messages preserve existing runtime;
  - background webhook acknowledgement still reaches durable completion.

## CI evidence
Code/runtime gate: HEAD `7f23ec429e10cfbd0a4eeeafd3c5995c249a2858`, SG 2.1 CI #7319 — SUCCESS.

CI #7319 passed `npm run check`, `npm start`, `npm run start:worker`, Block 19 security gate and independent diagnostics verification.

## Acceptance boundary
This evidence proves repository implementation and CI/runtime composition. It does not claim real Telegram live-production acceptance; that remains TWM1.12.

## Final closure rule
TWM1.8 is CLOSED only after the final documentation-synchronized HEAD also receives a complete green SG 2.1 CI. The final HEAD/CI pair must be appended here or referenced by the canonical TWM program before closure is declared.
