# Block 17 — Render Deployment

## Status

**IMPLEMENTATION COMPLETE / LIVE WEB RUNTIME EVIDENCE PRESENT / NOT FORMALLY CLOSED.**

The earlier statement that external Render runtime evidence was entirely missing is superseded: the SG 2.1 web runtime is deployed and has repeatedly served live Telegram acceptance on `dev/sg2.1-semantic`. Formal Block 17 closure still requires the complete acceptance checklist below, especially the independent durable-worker/restart and rollback-rehearsal evidence where not yet recorded.

## Goal

Deploy SG 2.1 through the already configured SG 2.0 Render Web Service without changing that service's existing Render settings, while preserving SG 2.1 runtime, persistence, worker, identity, capability, Action Gate and AI Router boundaries.

## Approved branch

Only `dev/sg2.1-semantic` may be deployed for SG 2.1. `main` is not the SG 2.1 deployment source.

## Existing Render Web Service compatibility

The existing service is configured for the required repository/branch model:

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

`npm start` remains `node src/runtime/entrypoint.js`. The entrypoint detects the existing Render environment and delegates to the long-lived production web entrypoint. Outside Render it preserves deterministic verification behavior used by CI.

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
- configured Monarch authority is bound through canonical SG identity/security policy;
- a new unconfigured user receives only the ordinary bounded user/guest capabilities defined by current policy;
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

Therefore web deployment evidence must not be silently promoted into worker evidence. Formal Block 17 closure still requires proof of the real durable worker process using `npm run start:worker` and its restart/reconnect behavior.

## Current live evidence

Current project checkpoints/live acceptance prove at least:
- Telegram production runtime has been deployed and operational on the SG 2.1 working branch;
- live Telegram workspace discovery/configuration and configuration persistence across redeploy/restart have been observed;
- response modes have changed real live runtime behavior;
- TWM publication/media/poll/quiz and scheduled-publication paths have produced live Telegram evidence;
- PDK4.13 live repository analysis has executed through the deployed SG runtime and returned a repository-derived answer.

These observations prove that external Render web-runtime evidence exists. They do **not** automatically satisfy every Block 17 acceptance item below.

## Deployment procedure — existing Web Service

1. Do not change the existing Render Web Service settings without a separate reviewed reason.
2. Confirm it still points to repository `korzh260609-beep/garya-bot` and branch `dev/sg2.1-semantic`.
3. Keep Build Command `npm install` unless an approved deployment change supersedes it.
4. Keep Start Command `npm start`.
5. Keep required Environment values secret and out of repository documentation/logs.
6. Trigger a controlled deployment of the exact CI-verified working-branch revision.
7. Confirm migration completion before runtime readiness.
8. Confirm `/health` and `/ready` where available.
9. Confirm Telegram webhook reconnect and a real test update.
10. Record deployed commit/revision evidence when available.

## Rollback procedure

1. Stop promotion if migrations fail, `/ready` fails or Telegram does not reconnect.
2. Do not alter `main` to recover SG 2.1.
3. Roll the existing Render Web Service back to the last known-good deployment from `dev/sg2.1-semantic`.
4. Keep PostgreSQL intact unless a separately reviewed restore is required.
5. Do not manually delete migration rows or force destructive schema downgrades.
6. Reverify `/health`, `/ready` and Telegram webhook after rollback.

## Acceptance evidence required for formal operational completion

- [x] SG 2.1 has real external Render web-runtime / Telegram live evidence on the working branch;
- [ ] exact final Block 17 closure HEAD is recorded with green CI and deployment evidence;
- [ ] successful migration-on-boot before that closure runtime start is recorded;
- [ ] `/health` 200 and `/ready` 200 are recorded for the closure revision;
- [ ] Telegram webhook is recorded against that deployed closure revision;
- [ ] web reconnect after restart is explicitly recorded for the closure revision;
- [ ] durable worker is proven as its own real process and reconnects after restart;
- [ ] rollback procedure is verified/rehearsed against a safe non-production/known-good revision;
- [ ] no security/identity/credential boundary was weakened to obtain deployment evidence.

Unchecked items mean formal Block 17 closure evidence is still incomplete; they do not mean the web runtime is absent.

## Next

Blocks 18–19 have since been implemented/accepted in the wider SG 2.1 program, so the old sequencing sentence “do not start Block 18” is historical and no longer current. Block 17 itself remains **NOT FORMALLY CLOSED** until its own remaining acceptance evidence is recorded.
