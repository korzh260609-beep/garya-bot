# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `RENDER-CONTROL-V1-LOGS-001`
STATUS: `PENDING`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `agent-workspace-render-control-v1`
WORKFLOW_POINT: `render-error-logs-check-after-status-and-deploys-ok`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T17:10:00Z`
UPDATED_AT: `2026-04-26T17:10:00Z`

---

## Payload

level=error
minutes=360
limit=100
maxLineChars=700

---

## Last result

Pending Render error logs report after successful Render status and deploys control checks.

---

## Allowed statuses

- `EMPTY`
- `PENDING`
- `RUNNING`
- `DONE`
- `FAILED`
- `IGNORED`

## Allowed actions

- `VERIFY_DEPLOY`
- `COLLECT_RENDER_REPORT`
- `COLLECT_RENDER_LOGS`
- `COLLECT_RENDER_DEPLOYS`
- `COLLECT_RENDER_DEPLOY`
- `COLLECT_RENDER_STATUS`
- `WRITE_TEST_NOTE`
- `RUN_DIAGNOSTIC_COMMANDS`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
