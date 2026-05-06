# Agent Workspace HTTP Environment

Agent Workspace HTTP trigger is the preferred simple event-driven mode for SG 2.0.

## Required flags

```text
AGENT_WORKSPACE_ENABLED=false
AGENT_WORKSPACE_WEBHOOK_ENABLED=false
AGENT_WORKSPACE_WEBHOOK_TOKEN=
AGENT_WORKSPACE_GITHUB_WRITE_ENABLED=false
```

## Project defaults

```text
GITHUB_REPO=korzh260609-beep/garya-bot
GITHUB_BRANCH=dev/v2-start
```

## Optional polling runtime

HTTP trigger is preferred. Polling remains optional and disabled by default.

```text
AGENT_WORKSPACE_RUNTIME_ENABLED=false
AGENT_WORKSPACE_RUNTIME_EXECUTION_ENABLED=false
AGENT_WORKSPACE_RUNTIME_INTERVAL_MS=60000
AGENT_WORKSPACE_RUNTIME_MODE=read_only_command_reader
```

## Render read-only diagnostics

```text
RENDER_INTEGRATION_ENABLED=false
RENDER_API_KEY=
RENDER_API_BASE_URL=https://api.render.com/v1
RENDER_DEFAULT_SERVICE_ID=
RENDER_DEFAULT_OWNER_ID=
RENDER_API_TIMEOUT_MS=15000
RENDER_DEFAULT_LOG_LIMIT=100
RENDER_DEFAULT_DEPLOY_LIMIT=10
RENDER_DEFAULT_LOG_WINDOW_MINUTES=60
```

## HTTP endpoints

```text
POST /agent-workspace/github-webhook
POST /agent-workspace/run-once
GET  /agent-workspace/run-once
```

## Safety

- GitHub writes are disabled unless `AGENT_WORKSPACE_GITHUB_WRITE_ENABLED=true`.
- Writes are restricted to `agent_workspace/COMMANDS.md` and allowlisted workspace reports.
- Render write/deploy actions are not supported.
- Source code, pillars, secrets, Telegram, DB, and AI are not written by these routes.
