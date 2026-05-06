# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `render-env-status-live-20260506-1329z`
STATUS: `PENDING`
ACTION: `COLLECT_RENDER_ENV_STATUS`
TASK_ID: `manual-render-env-status-live-test`
WORKFLOW_POINT: `Agent Workspace RenderAgent live test`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `MONARCH_GARY`
CREATED_AT: `2026-05-06T13:29:00Z`
UPDATED_AT: `2026-05-06T13:29:00Z`

---

## Payload

```json
{
  "target": "render_env_status",
  "mode": "read_only",
  "expected_reports": [
    "agent_workspace/render/RENDER_ENV_STATUS_REPORT.md"
  ]
}
```

---

## Last result

Live test command prepared.

---

## Allowed statuses

- `EMPTY`
- `PENDING`
- `RUNNING`
- `DONE`
- `FAILED`
- `IGNORED`

## Allowed actions

- `COLLECT_RENDER_ENV_STATUS`
- `COLLECT_RENDER_LOGS`
- `COLLECT_RENDER_DEPLOYS`
- `COLLECT_RENDER_DEPLOY`
- `COLLECT_RENDER_STATUS`

## Hard limits

- SG must run only `STATUS: PENDING` commands.
- SG must ignore already completed commands.
- SG must update only allowlisted files in `agent_workspace/`.
- `COMMANDS.md` must not be auto-cleared by the workspace cleaner.
- If `REQUIRES_COMMIT` is set, SG must skip execution until runtime commit matches it.
