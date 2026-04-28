# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-DEPLOYS-070`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_DEPLOYS`
TASK_ID: `render-latest-deploys-check-70`
WORKFLOW_POINT: `render-latest-deploys-check-70`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T13:35:00.000Z`
UPDATED_AT: `2026-04-28T13:31:22.265Z`

---

## Payload

limit: 5
reason: user_requested_latest_deploy_log_last_50_lines_step_1_get_latest_deploy_id

---

## Last result

Action completed: COLLECT_RENDER_DEPLOYS
Task ID: render-latest-deploys-check-70
Workflow point: render-latest-deploys-check-70
Deploy ID: -
Commit: 58bd75d426b16fb43865eebffbb23a8c225cbd32
Required commit: -
Runtime commit: 58bd75d426b16fb43865eebffbb23a8c225cbd32
Logs: 0
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
