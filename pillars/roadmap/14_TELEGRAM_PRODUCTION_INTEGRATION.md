# Block 14 — Telegram Production Integration

## Status

Implemented on `dev/sg2.1-semantic` and accepted by green CI.

## Production boundary

Telegram remains a transport. It provides platform identity facts, chat facts, message facts, addressing metadata and delivery mechanics. It does not interpret user meaning, assign roles, assign grants, choose capabilities or generate business responses. Identity and Scope resolves the actor and scope before the original user text enters the semantic runtime.

## Semantic-first interaction rule

Users are never required to memorize technical commands, keywords or fixed phrases.

Natural-language requests such as:

- `Что ты обо мне помнишь?`
- `Расскажи, кто я для тебя`
- `Какие мои дела ещё не закончены?`
- `Есть ли у системы проблемы?`

are passed unchanged to the SG runtime. Their meaning is resolved only by the semantic layer and later mapped through Decision Engine, Action Gate and capabilities.

Telegram bot commands may exist as optional platform shortcuts, but the transport does not maintain a command-name allowlist and does not attach business meaning to command text. A Telegram `bot_command` entity is only evidence that a group message was explicitly addressed to the bot.

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
  - group and supergroup explicit addressing;
  - reply, mention and Telegram `bot_command` entity detection;
  - no command allowlist;
  - no keyword routing;
  - no transport-level response renderer.
- `src/telegram/telegramConfig.js`
  - validated production and sandbox configuration.

## Invocation rules

- Private chats: every non-empty text or caption is accepted and passed unchanged to semantic runtime.
- Groups and supergroups: SG responds only when the message is explicitly addressed through a reply to the bot, an explicit mention or Telegram's structured `bot_command` entity.
- Group admission uses Telegram addressing metadata only. It does not inspect words to infer intent.
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
- arbitrary natural-language messages pass unchanged to runtime;
- no fixed command-name or keyword routing in Telegram transport;
- separate identities for different group users;
- group and topic scope isolation;
- reply, mention and structured platform-command addressing;
- flood-control retry and normalized API errors;
- visible failure when Telegram delivery is unavailable.
