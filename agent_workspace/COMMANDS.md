# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `RAW-RENDER-LOGS-SMOKE-001`
STATUS: `PENDING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `raw-render-logs-smoke-001`
WORKFLOW_POINT: `raw-render-logs-smoke-001`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `37beb889d9302c95a6d2fb27134d788f41226aa9`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T14:20:00.000Z`
UPDATED_AT: `2026-04-28T14:20:00.000Z`

---

## Payload

/render_bridge_deploys 5
/render_bridge_logs 20
/render_bridge_logs latest 50

---

## Last result

-

---

## Allowed statuses

- `EMPTY`
- `WAITING_DEPLOY`
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
- `RUN_REPO_STATE_SCAN`
- `RUN_REPO_STATE_AGENT`
- `RUN_REPO_STATE_AGENT_REAL_AI`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- `WAITING_DEPLOY` commands are visible but never executed.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
- If `REQUIRES_COMMIT` is set, SG must skip execution until runtime commit matches it.
