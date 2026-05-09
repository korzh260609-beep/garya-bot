# SG Diagnostics V1 Status

## Status

SG Diagnostics Layer V1 is active on `dev/v2-start`.

V1 supports natural-language diagnostics requests from the Monarch, for example:

```text
SG, check project status after deploy
СГ, проверь состояние проекта после деплоя
```

The Monarch does not need slash commands or exact technical phrases.

## Verified capabilities

Runtime-observed diagnostics confirmed the following checks work:

1. Render logs collection.
2. Render env inventory collection with secret values hidden.
3. GitHub Actions latest workflow status check.
4. Repository registry refresh/check.
5. Recent commits search.
6. Tool `finalText` fallback for diagnostics reports when model output is empty after a tool call.

## Latest observed healthy diagnostics result

Runtime diagnostics reported:

- Render logs: 83 records collected and stored under `runtime/render/latest/latest-render-logs.json`.
- Render env: 20 environment variables detected and stored with secret values hidden.
- GitHub Actions: workflow `SG2 Smoke` on `dev/v2-start` completed successfully.
- Observed workflow run number: `349`.
- Observed workflow commit: `f401aaa83c523812dc33b722cf130b61493accf5`.
- Repo registry: current registry contains 255 items.
- Recent commits: relevant merge commit `20a23e22299fdcd1fd45969a448fd55a61910c01` added SG diagnostics runtime logic.

Note: the external connector did not return workflow data for commit `f401aaa83c523812dc33b722cf130b61493accf5`, but the runtime SG diagnostics path did report the workflow run as successful. Treat this as a runtime-observed diagnostics fact.

## GitHub auth rule

Do not use `GITHUB_TOKEN` in Render for SG runtime GitHub writes.

Runtime writes must use GitHub App installation authentication through:

```text
GITHUB_APP_ID
GITHUB_APP_INSTALLATION_ID
GITHUB_APP_PRIVATE_KEY
```

Reason: if `GITHUB_TOKEN` is present, the GitHub API client uses it before GitHub App auth. A personal access token can cause runtime workspace writes to fail with:

```text
workspace_write_failed:403:Resource not accessible by personal access token
```

Therefore:

- `GITHUB_TOKEN` must stay absent from Render env for SG runtime.
- Runtime workspace writes must use GitHub App installation token.
- The GitHub App must keep repository `Contents` permission with read/write access for `korzh260609-beep/garya-bot`.

## Boundaries

Diagnostics V1 must remain read-only for project logic and infrastructure:

- no code mutation;
- no Render env mutation;
- no Render deploy/restart action;
- no GitHub settings mutation;
- no transport-specific dependency;
- no direct core handler coupling.

Runtime report writes under `runtime/` are allowed because they are generated diagnostics artifacts.

## Next improvements

Future PRs may improve:

1. richer diagnostics report formatting;
2. explicit pass/fail summary per source;
3. direct workflow run/job details;
4. dependency vulnerability diagnostics as a separate module;
5. diagnostics history retention instead of latest-only reports.
