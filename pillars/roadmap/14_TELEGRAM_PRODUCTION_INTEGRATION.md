# Block 14 — Telegram Production Integration

## Status

Implemented on `dev/sg2.1-semantic` and accepted by green CI.

## Production boundary

Telegram remains a transport. It provides platform identity facts, chat facts, message facts and delivery mechanics. It does not assign roles, grants or final scopes. Identity and Scope resolves the actor and scope before the request enters the semantic runtime.

## Implemented components

- `src/telegram/telegramWebhookHttpHandler.js`
  - POST endpoint at `/webhooks/telegram` by default;
  - bounded JSON body size;
  - method and payload validation.
- `src/telegram/telegramProductionIntegration.js`
  - constant-time webhook secret verification;
  - update claiming before execution;
  - full `TelegramTransportAdapter → runtime.handle → sendMessage` path;
  - visible bounded failure status.
- `src/telegram/postgresTelegramUpdateStore.js`
  - durable update deduplication by Telegram `update_id`;
  - processing, completed, ignored and failed states.
- `src/persistence/migrations/004_block14_telegram_updates.sql`
  - durable Telegram update table and diagnostic index.
- `src/telegram/telegramBotApiClient.js`
  - Bot API calls;
  - `sendMessage`, `setWebhook`, `deleteWebhook`, `getWebhookInfo`;
  - timeout, bounded retries and Telegram flood-control handling;
  - normalized Telegram failures.
- `src/telegram/telegramInvocation.js`
  - private chat handling;
  - group and supergroup explicit invocation;
  - reply and mention detection;
  - topic preservation;
  - commands `/start`, `/help`, `/profile`, `/tasks`, `/health`.
- `src/telegram/telegramConfig.js`
  - validated production and sandbox configuration.

## Invocation rules

- Private chats: text commands and messages are accepted.
- Groups and supergroups: SG responds only to a supported command, a reply to the bot, or an explicit bot mention.
- Silent group traffic is acknowledged and stored as ignored update evidence without entering the SG runtime.
- Telegram topic `message_thread_id` becomes thread scope only after centralized Identity and Scope resolution.

## Security and reliability

- Webhook requests require `X-Telegram-Bot-Api-Secret-Token`.
- Telegram tokens and webhook secrets are configuration secrets and are never committed.
- Duplicate update IDs cannot execute the SG runtime twice.
- Telegram delivery outages return bounded `503` failures and mark the durable update as failed.
- Bot API 429 responses respect `retry_after` with bounded retries.

## Configuration

Required deployment secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_WEBHOOK_URL`

Operational values:

- `TELEGRAM_BOT_USER_ID`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_WEBHOOK_PATH`
- `TELEGRAM_API_TIMEOUT_MS`
- `TELEGRAM_API_MAX_RETRIES`
- `TELEGRAM_SANDBOX_ENABLED`

## Acceptance evidence

CI verifies:

- repeatable migration count with Block 14 migration;
- webhook secret rejection;
- durable/in-memory update deduplication contract;
- full transport-to-runtime-to-delivery path;
- separate identities for different group users;
- group and topic scope isolation;
- reply, mention and command invocation;
- flood-control retry and normalized API errors;
- visible failure when Telegram delivery is unavailable.

The accepted suite contains 117 tests with zero failures and zero skips. CI also verifies `npm start` and `npm run start:worker` after the Telegram tests.
