# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-DEPLOY-071`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_DEPLOY`
TASK_ID: `render-latest-deploy-log-check-71`
WORKFLOW_POINT: `render-latest-deploy-log-check-71`
DEPLOY_ID: `dep-d7ob9ipo3t8c73f6mnog`
REQUIRES_COMMIT: `-`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T13:40:00.000Z`
UPDATED_AT: `2026-04-28T13:32:28.736Z`

---

## Payload

lastLines: 50
reason: user_requested_latest_deploy_log_last_50_lines_step_2_collect_latest_deploy

---

## Last result

Started by github_webhook at 2026-04-28T13:32:28.736Z.

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
