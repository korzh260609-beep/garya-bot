# Block 17 — Render Deployment

## Status

Implementation complete. External Render runtime evidence is still required before marking the block operationally completed.

## Goal

Deploy SG 2.1 through the same proven Render-to-GitHub connection model used by SG 2.0, while preserving SG 2.1 runtime, persistence, worker, identity, capability, Action Gate and AI Router boundaries.

## Approved branch

Only `dev/sg2.1-semantic` may be deployed for SG 2.1. `main` is not the SG 2.1 deployment source.

## Render connection model

SG 2.1 does not require a Render Blueprint.

Use the existing Render service connection pattern from SG 2.0:

1. Render service is connected directly to GitHub repository `korzh260609-beep/garya-bot`.
2. Render service branch is set to `dev/sg2.1-semantic`.
3. Repository changes on that branch are deployed by Render according to the service auto-deploy setting.
4. Secrets and deployment-specific values remain in Render Environment settings, not in GitHub.
5. Telegram webhook is registered automatically by the SG web process after a successful start.

The removed `render.yaml` Blueprint path is not part of the supported Block 17 deployment procedure.

## Web service

The existing Render Web Service should be reused instead of creating a new Blueprint-managed web service.

Required settings:

- repository: `korzh260609-beep/garya-bot`;
- branch: `dev/sg2.1-semantic`;
- build command: `npm ci`;
- pre-deploy command: `npm run migrate` when the Render plan/service supports a pre-deploy command; otherwise migrations must be run through an explicitly controlled deployment step before starting an incompatible runtime;
- start command: `npm run start:render`;
- health check path: `/health`.

Runtime endpoints:

- `/health` — process/runtime health;
- `/ready` — runtime plus PostgreSQL readiness;
- Telegram webhook path defaults to `/webhooks/telegram`.

The Render web runtime supplies safe production defaults for `SG_ENVIRONMENT=production`, `SG_PROJECT_SCOPE=sg2.1`, and derives PostgreSQL persistence mode when `DATABASE_URL` is present. Explicit Render ENV values still override these defaults.

## Worker service

SG 2.1 still requires the durable Block 13 worker. This architectural requirement is independent from the Render Blueprint decision.

The worker should be a Render Background Worker connected manually to the same GitHub repository and the same approved branch:

- repository: `korzh260609-beep/garya-bot`;
- branch: `dev/sg2.1-semantic`;
- build command: `npm ci`;
- start command: `npm run start:worker`;
- PostgreSQL `DATABASE_URL` shared with the web runtime;
- production worker policy remains fail-closed for unsupported/protected execution.

Do not run a second Telegram web listener inside the worker.

## PostgreSQL

Reuse the production PostgreSQL database when it is compatible with SG 2.1 migration requirements. Do not create a duplicate database merely because Block 17 previously contained a Blueprint definition.

Required properties:

- durable PostgreSQL connection available as `DATABASE_URL`;
- migrations versioned and checksum-verified;
- backups enabled according to the Render database plan and production policy;
- no credentials committed to GitHub.

## Environment and secrets

Keep deployment secrets only in Render Environment settings.

Required or expected production values include:

- `DATABASE_URL`;
- `TELEGRAM_BOT_TOKEN` or legacy SG 2.0 alias `BOT_TOKEN`;
- `SG_MONARCH_TELEGRAM_USER_ID`;
- `OPENAI_API_KEY` when production AI is intentionally enabled.

Optional Telegram values:

- `BASE_URL` — may remain from SG 2.0; if absent, SG 2.1 can derive the public URL from Render-provided URL/hostname variables;
- `TELEGRAM_WEBHOOK_SECRET` — optional; SG 2.1 derives a stable secret when absent;
- `TELEGRAM_WEBHOOK_PATH` — default `/webhooks/telegram`.

Production AI remains disabled unless `SG_AI_ENABLED=true` is explicitly configured.

## Telegram webhook

The SG 2.1 web process follows the SG 2.0 operational model: it registers the Telegram webhook automatically after startup unless `TELEGRAM_REGISTER_WEBHOOK=false` is explicitly set.

Unlike SG 2.0, the bot token is not embedded in the webhook path. SG 2.1 uses Telegram's webhook secret-token verification and keeps the default path `/webhooks/telegram`.

The public base URL is resolved in this order:

1. `BASE_URL` / explicit webhook URL when configured;
2. Render-provided external URL;
3. Render-provided external hostname.

This allows the existing SG 2.0 Render environment to be reused with minimal changes.

## Deployment procedure

1. Open the existing Render Web Service used for SG.
2. Confirm repository `korzh260609-beep/garya-bot`.
3. Change/confirm branch to `dev/sg2.1-semantic`.
4. Set build command to `npm ci`.
5. Set start command to `npm run start:render`.
6. Configure migration execution before incompatible runtime startup.
7. Preserve existing Telegram bot token and compatible database settings in Render ENV; add SG 2.1-specific values only when required.
8. Deploy the approved branch.
9. Confirm `/health` returns HTTP 200.
10. Confirm `/ready` returns HTTP 200 after PostgreSQL is ready.
11. Confirm Telegram webhook is registered to the current Render Web Service URL.
12. Connect/start the separate Render Background Worker on the same repository and branch with `npm run start:worker`.
13. Record deployed commit SHA and Render deploy IDs as evidence.

## Rollback procedure

1. Stop promotion if `/ready` fails, Telegram does not reconnect, or the worker cannot reconnect.
2. Do not alter `main` to recover SG 2.1.
3. Roll the Render Web Service and worker back to the last known-good deployment from `dev/sg2.1-semantic`.
4. Keep PostgreSQL intact unless a separately reviewed restore is required.
5. Do not manually delete migration rows or force destructive schema downgrades.
6. Reverify `/health`, `/ready`, worker health and Telegram webhook after rollback.

## Acceptance evidence required for operational completion

- GitHub CI green for the Block 17 HEAD;
- Render Web Service connected to `korzh260609-beep/garya-bot` and `dev/sg2.1-semantic`;
- no Blueprint dependency;
- secrets absent from repository and ordinary logs;
- successful Render web deployment;
- successful migration before incompatible runtime startup;
- `/health` 200 and `/ready` 200;
- Telegram webhook registered to the deployed Render service;
- worker connected to the same repo/branch and running successfully;
- web and worker reconnect after restart;
- rollback procedure verified or rehearsed against a non-production revision.

## Next

Do not start Block 18 until the external Render runtime evidence above is complete.
