# Block 14 — Telegram Production Integration

## Status

Implemented on `dev/sg2.1-semantic` and accepted by green CI.

## Production boundary

Telegram remains a transport. It provides platform identity facts, chat facts, message facts, addressing metadata and delivery mechanics. It does not interpret user meaning, assign roles, assign grants, choose capabilities or generate business responses. Identity and Scope resolves the actor and scope before the original user text enters the semantic runtime.

## Semantic-first interaction rule

Users are never required to memorize technical commands, keywords or fixed phrases. Natural-language requests are passed unchanged to the SG runtime. Their meaning is resolved only by the semantic layer and later mapped through Decision Engine, Action Gate and capabilities.

Telegram bot commands may exist as optional platform shortcuts, but the transport does not maintain a command-name allowlist and does not attach business meaning to command text. A Telegram `bot_command` entity is only evidence that a group message was explicitly addressed to the bot.

## Implemented components

- `src/telegram/telegramWebhookHttpHandler.js` — bounded POST webhook endpoint.
- `src/telegram/telegramProductionIntegration.js` — secret verification, durable dedupe, runtime path and delivery.
- `src/telegram/postgresTelegramUpdateStore.js` — durable update states.
- `src/persistence/migrations/004_block14_telegram_updates.sql` — Telegram update persistence.
- `src/telegram/telegramBotApiClient.js` — Bot API, timeout, retries and flood control.
- `src/telegram/telegramInvocation.js` — private messages and structured group addressing without keyword routing.
- `src/telegram/telegramConfig.js` — SG 2.0-compatible Render configuration.

## Invocation rules

- Private chats: every non-empty text or caption is accepted and passed unchanged to semantic runtime.
- Groups and supergroups: SG responds only when explicitly addressed through a reply, mention or Telegram `bot_command` entity.
- Group admission uses Telegram addressing metadata only. It does not inspect words to infer intent.
- Silent group traffic is stored as ignored update evidence without entering the SG runtime.
- Telegram topic `message_thread_id` becomes thread scope after centralized Identity and Scope resolution.

## Render configuration compatibility

SG 2.1 reuses the environment already used by SG 2.0.

Required existing value:

- `TELEGRAM_BOT_TOKEN`, with legacy `BOT_TOKEN` accepted as fallback.

Public URL resolution follows SG 2.0 compatibility:

1. `BASE_URL` when explicitly configured;
2. Render-provided `RENDER_EXTERNAL_URL`;
3. Render-provided `RENDER_EXTERNAL_HOSTNAME`.

The webhook URL is assembled automatically with the safe default path `/webhooks/telegram`. The bot token is never placed in the webhook path.

No new Render ENV is required for the default deployment. The following are optional overrides only:

- `TELEGRAM_WEBHOOK_SECRET` — otherwise derived deterministically from the existing token;
- `TELEGRAM_WEBHOOK_PATH`;
- `TELEGRAM_BOT_USER_ID`;
- `TELEGRAM_BOT_USERNAME`;
- `TELEGRAM_API_TIMEOUT_MS`;
- `TELEGRAM_API_MAX_RETRIES`;
- `TELEGRAM_SANDBOX_ENABLED`.

## Security and reliability

- Webhook requests require `X-Telegram-Bot-Api-Secret-Token`.
- The Telegram token is not exposed in the webhook URL.
- Duplicate update IDs cannot execute the SG runtime twice.
- Telegram delivery outages return bounded failures and mark the durable update as failed.
- Bot API 429 responses respect `retry_after` with bounded retries.

## Acceptance evidence

CI verifies:

- SG 2.0 `TELEGRAM_BOT_TOKEN` and legacy `BOT_TOKEN` compatibility;
- Render URL/hostname auto-resolution;
- automatic safe webhook URL assembly;
- webhook secret derivation and optional overrides;
- webhook secret rejection;
- durable update deduplication;
- full transport-to-runtime-to-delivery path;
- arbitrary natural-language messages pass unchanged;
- no fixed command-name or keyword routing;
- identity and scope isolation;
- Telegram flood-control handling and bounded failures.
