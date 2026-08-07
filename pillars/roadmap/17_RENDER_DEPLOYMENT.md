# Block 17 — Render Deployment

## Status

Implementation complete. External Render Blueprint sync and runtime evidence are required before marking the block operationally completed.

## Goal

Deploy SG 2.1 as a controlled production environment on Render without changing SG authority, AI routing, Action Gate, identity, memory or capability boundaries.

## Approved branch

Only `dev/sg2.1-semantic` is permitted for the Block 17 services. `render.yaml` pins both web and worker services to this branch.

## Services

### Web — `sg-2-1-web`

- build: `npm ci`;
- pre-deploy migration: `npm run migrate`;
- start: `npm run start:render`;
- health: `/health`;
- readiness: `/ready`;
- Telegram webhook: `/webhooks/telegram` by default;
- graceful SIGTERM/SIGINT shutdown.

The web process uses a long-lived production entrypoint. The existing `npm start` remains the deterministic verification entrypoint used by CI.

### Worker — `sg-2-1-worker`

- build: `npm ci`;
- pre-deploy migration: `npm run migrate`;
- start: `npm run start:worker`;
- durable PostgreSQL queue;
- retries, leases, heartbeat and DLQ remain inside the Block 13 worker boundary;
- SIGTERM/SIGINT graceful shutdown;
- health state is emitted through structured worker startup/shutdown logs and durable observability.

### PostgreSQL — `sg-2-1-postgres`

- PostgreSQL 16;
- private connection string injected into web and worker through `fromDatabase`;
- public database access disabled by Blueprint `ipAllowList: []`;
- migrations remain versioned and checksum-verified.

## Environment and secrets

Repository-safe values are declared in `render.yaml` and `.env.example`.

Secrets are never committed. The Blueprint requests these values through Render secret storage (`sync: false`):

- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_WEBHOOK_SECRET`;
- `SG_MONARCH_TELEGRAM_USER_ID`;
- `OPENAI_API_KEY`.

Production AI remains disabled by default until `SG_AI_ENABLED=true` is explicitly configured. The emergency disable switch remains independent.

## Identity bootstrap

Telegram platform identity remains only an identity fact. The production resolver:

- reuses an existing `(platform, platform_user_id)` link when present;
- creates a bounded Telegram global identity when no link exists;
- loads roles and grants from PostgreSQL;
- gives a new unconfigured user only `guest` plus `capability:compose-answer`;
- bootstraps `monarch` plus the Block 16 capability grants only when the Telegram user ID exactly matches the deployment secret `SG_MONARCH_TELEGRAM_USER_ID`.

No transport message can assign its own role, grant or scope.

## Health and readiness

`GET /health` reports process/runtime health. It can be healthy while the application is not yet ready to accept requests.

`GET /ready` additionally requires runtime readiness and a started PostgreSQL dependency. This distinction prevents a process-only health signal from being treated as dependency readiness.

Neither endpoint returns credentials, connection strings, tokens or user data.

## Telegram webhook registration

By default the web service registers its configured webhook during successful startup using the Block 14 Bot API client and secret token. Set `TELEGRAM_REGISTER_WEBHOOK=false` only when webhook registration is deliberately managed by a separate controlled procedure.

Registration target is derived from Render's public service URL plus `TELEGRAM_WEBHOOK_PATH` (default `/webhooks/telegram`).

## Deployment procedure

1. Sync the root `render.yaml` Blueprint in Render.
2. Confirm the Blueprint targets `dev/sg2.1-semantic` for both services.
3. Provide all `sync: false` secrets in Render secret storage.
4. Keep `SG_AI_ENABLED=false` for the first deployment unless production AI activation is explicitly intended.
5. Allow Render to run `npm ci` and `npm run migrate` before service start.
6. Confirm web `/health` returns HTTP 200.
7. Confirm web `/ready` returns HTTP 200 after PostgreSQL is ready.
8. Confirm worker startup log reports `worker-ready` without exposing secrets.
9. Confirm Telegram webhook information points to the SG 2.1 web service URL.
10. Record the deployed commit SHA and Render deploy IDs as runtime evidence.

## Rollback procedure

1. Stop promotion if `/ready` fails or worker cannot reconnect.
2. Do not reverse database migrations by deleting rows or editing `schema_migrations` manually.
3. Roll web and worker back to the last known-good deployment from the same approved branch.
4. Keep the PostgreSQL database intact unless a separately reviewed restore is required.
5. Verify `/health`, `/ready`, worker health and Telegram webhook after rollback.
6. If a migration is forward-only and incompatible with the previous runtime, deploy a reviewed forward compatibility fix instead of forcing a destructive schema downgrade.

## Acceptance evidence required for operational completion

- GitHub CI green for the Block 17 HEAD;
- Blueprint contains only the approved branch for SG 2.1 services;
- secret values absent from repository and ordinary logs;
- successful Render web deployment;
- successful Render worker deployment;
- successful migration before runtime start;
- `/health` 200 and `/ready` 200 in Render;
- worker reconnect after restart;
- web reconnect after restart;
- Telegram webhook registered to the deployed web service;
- rollback procedure verified or at minimum rehearsed against a non-production revision.

## Next

After operational Block 17 evidence is complete: Block 18 — End-to-End Verification.
