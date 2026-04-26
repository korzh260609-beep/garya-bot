# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `RENDER-CONTROL-V1-DEPLOYS-001`
STATUS: `PENDING`
ACTION: `COLLECT_RENDER_DEPLOYS`
TASK_ID: `agent-workspace-render-control-v1`
WORKFLOW_POINT: `render-deploys-history-check-after-status-ok`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T17:05:00Z`
UPDATED_AT: `2026-04-26T17:05:00Z`

---

## Payload

limit=20

---

## Last result

Pending Render deploys history report after successful Render status control check.

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
