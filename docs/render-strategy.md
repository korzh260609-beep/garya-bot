# Render Strategy for SG 2.0

> AGENT NOTE:
> This file defines how SG 2.0 stays compatible with the existing Render service.
> Do not change env names, start command, webhook path, database behavior, or external runtime assumptions without explicit Monarch approval.
> This file is a safety contract, not a feature roadmap.

## Branches

- `main` — stable old working project.
- `dev/v2-start` — clean SG 2.0 branch.

## Principle

SG 2.0 uses the same Render service settings as `main` at the start.

Render branch may be switched:

```text
main <-> dev/v2-start
```

## Runtime contract copied from main

SG 2.0 must keep compatibility with:

- `package.json` start command: `node ./index.js`;
- env names:
  - `BOT_TOKEN`;
  - `DATABASE_URL`;
  - `MONARCH_USER_ID`;
  - `PORT`;
- HTTP server port logic: `process.env.PORT || 3000`;
- health endpoint;
- Telegram webhook route when Telegram transport is implemented;
- database connection pattern when DB layer is implemented.

## Forbidden without final МОЖНО

- rename env variables;
- change Render build/start contract;
- change webhook path;
- run dangerous DB migrations;
- change external webhook state;
- write irreversible data into shared production DB.

## Rollback

If SG 2.0 fails:

1. switch Render branch back to `main`;
2. run Manual Deploy latest commit;
3. check `/health`;
4. check Telegram response.
