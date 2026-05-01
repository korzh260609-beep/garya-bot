# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `COLLECT-RENDER-LOGS-LATEST-100-20260501-003`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `collect-render-logs-latest-100-20260501-003`
WORKFLOW_POINT: `manual-render-latest-100-logs-request`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-05-01T10:25:00.000Z`
UPDATED_AT: `2026-05-01T10:46:05.387Z`

---

## Payload

target=latest_count
limit=100
partSize=100
maxLineChars=1200
level=all
writeTo=agent_workspace/RENDER_LOGS_REPORT.md

---

## Last result

Action completed: COLLECT_RENDER_LOGS
Task ID: collect-render-logs-latest-100-20260501-003
Workflow point: manual-render-latest-100-logs-request
Deploy ID: -
Commit: 989428ddf88ea4c1b40a853a6c387c3c53e10cf2
Required commit: -
Runtime commit: 989428ddf88ea4c1b40a853a6c387c3c53e10cf2
Logs: 100
Diagnosis: false
Diagnostic commands: 0
Diagnostics OK: 0
Diagnostics failed: 0

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
