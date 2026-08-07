# Block 17 — Render Deployment

## Status

Implementation complete. External Render runtime evidence is still required before marking the block operationally completed.

## Goal

Deploy SG 2.1 through the already configured SG 2.0 Render Web Service without changing that service's existing Render settings, while preserving SG 2.1 runtime, persistence, worker, identity, capability, Action Gate and AI Router boundaries.

## Approved branch

Only `dev/sg2.1-semantic` may be deployed for SG 2.1. `main` is not the SG 2.1 deployment source.

## Existing Render Web Service compatibility

The existing service is already configured with the required repository and branch:

- repository: `korzh260609-beep/garya-bot`;
- branch: `dev/sg2.1-semantic`;
- root directory: repository root;
- build command remains `npm install`;
- pre-deploy command may remain empty;
- start command remains `npm start`;
- Auto-Deploy may remain Off;
- existing Environment values remain in Render.

No Render Blueprint is required and the removed `render.yaml` path is not used.

### Compatibility layer

`npm start` remains `node src/runtime/entrypoint.js`. The entrypoint detects the existing Render environment and delegates to the long-lived production web entrypoint. Outside Render it preserves the deterministic verification behavior used by CI.

The production web runtime supplies defaults when the legacy Render environment does not contain SG 2.1-specific names:

- `SG_ENVIRONMENT=production`;
- `SG_PROJECT_SCOPE=sg2.1`;
- PostgreSQL persistence when `DATABASE_URL` is present;
- `MONARCH_USER_ID` is accepted as the legacy alias for `SG_MONARCH_TELEGRAM_USER_ID`.

Existing `TELEGRAM_BOT_TOKEN`, `BASE_URL`, `DATABASE_URL` and `DATABASE_SSL` are reused directly.

## Migrations

The existing Render environment has `RUN_MIGRATIONS_ON_BOOT=1`. SG 2.1 intentionally supports this legacy deployment behavior for this service:

1. `npm start` detects Render and enters the production web entrypoint.
2. Before the web runtime starts, the SG 2.1 checksum-verified PostgreSQL migrator runs when `RUN_MIGRATIONS_ON_BOOT` is enabled.
3. The migration database connection is closed.
4. The production web runtime starts only after successful migration completion.

A migration failure therefore prevents the incompatible runtime from becoming active. No Render Pre-Deploy Command is required for the reused SG 2.0 Web Service.

## Web runtime

Runtime endpoints:

- `/health` — process/runtime health;
- `/ready` — runtime plus PostgreSQL readiness;
- Telegram webhook path defaults to `/webhooks/telegram`.

The process binds to Render's `PORT`, supports graceful SIGTERM/SIGINT shutdown and keeps secrets out of startup logs.

## Telegram webhook

The SG 2.1 web process follows the SG 2.0 operational model: it registers the Telegram webhook automatically after successful startup unless `TELEGRAM_REGISTER_WEBHOOK=false` is explicitly configured.

Existing `TELEGRAM_BOT_TOKEN` is reused. Existing `BASE_URL` is reused as the public Render URL. If `BASE_URL` is absent in another deployment, SG 2.1 can derive the public URL from Render-provided URL or hostname values.

Unlike SG 2.0, the bot token is not embedded in the webhook path. SG 2.1 uses Telegram webhook secret-token verification and the default path `/webhooks/telegram`.

## Identity bootstrap

The existing `MONARCH_USER_ID` value is reused as a compatibility alias for `SG_MONARCH_TELEGRAM_USER_ID`.

The production resolver still enforces the SG 2.1 authority model:

- Telegram platform identity is only an identity fact;
- existing identity links are reused;
- a configured monarch receives the monarch role and approved capability grants;
- a new unconfigured user receives only guest plus `capability:compose-answer`;
- transport input cannot self-assign roles, grants or scope.

## PostgreSQL

The existing production `DATABASE_URL` is reused. A duplicate database is not required.

Required properties remain:

- durable PostgreSQL connection;
- versioned checksum-verified SG 2.1 migrations;
- existing Render database protection/backups according to the current plan;
- no database credentials committed to GitHub.

## AI

Existing `OPENAI_API_KEY` may remain in Render. Production AI is still controlled by the SG 2.1 AI Router and its own enable/emergency gates. No direct AI call path is introduced by Render compatibility.

## Durable worker boundary

The existing SG 2.0 Render Web Service can host the SG 2.1 web runtime without Render changes.

However, Block 13's durable background worker is intentionally a separate process boundary. It is not embedded into the web process because doing so would violate the approved architecture and weaken independent restart/lease/health behavior.

Therefore zero-change reuse applies to the web deployment. Operational completion of Block 17 still requires a real durable worker process using `npm run start:worker`. If no such Render worker already exists, creating one is the one remaining infrastructure action that cannot be reproduced inside the existing Web Service without changing architecture.

## Deployment procedure — existing Web Service

1. Do not change the existing Render Web Service settings.
2. Confirm it still points to repository `korzh260609-beep/garya-bot` and branch `dev/sg2.1-semantic`.
3. Keep Build Command `npm install`.
4. Keep Pre-Deploy Command empty.
5. Keep Start Command `npm start`.
6. Keep the current Environment values, including `RUN_MIGRATIONS_ON_BOOT=1`, `TELEGRAM_BOT_TOKEN`, `BASE_URL`, `DATABASE_URL`, `DATABASE_SSL` and `MONARCH_USER_ID`.
7. Trigger a controlled manual deploy while Auto-Deploy is Off.
8. Confirm migration completion in logs before `render-web-ready`.
9. Confirm `/health` returns HTTP 200.
10. Confirm `/ready` returns HTTP 200.
11. Confirm Telegram webhook points to the current Render service and the bot receives/responds to a test update.
12. Record the deployed commit SHA and Render deploy ID as evidence.

## Rollback procedure

1. Stop promotion if migrations fail, `/ready` fails or Telegram does not reconnect.
2. Do not alter `main` to recover SG 2.1.
3. Roll the existing Render Web Service back to the last known-good deployment from `dev/sg2.1-semantic`.
4. Keep PostgreSQL intact unless a separately reviewed restore is required.
5. Do not manually delete migration rows or force destructive schema downgrades.
6. Reverify `/health`, `/ready` and Telegram webhook after rollback.

## Acceptance evidence required for operational completion

- GitHub CI green for the Block 17 HEAD;
- existing Render Web Service still connected to `korzh260609-beep/garya-bot` and `dev/sg2.1-semantic`;
- successful migration-on-boot before runtime start;
- successful Render web deployment using unchanged `npm install` / `npm start` settings;
- `/health` 200 and `/ready` 200;
- Telegram webhook registered to the deployed web service;
- web reconnect after restart;
- durable worker running as its own process and reconnecting after restart;
- rollback procedure verified or rehearsed against a non-production revision.

## Next

Do not start Block 18 until the external Render runtime evidence above is complete.
