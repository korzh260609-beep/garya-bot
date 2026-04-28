# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-LATEST-DEPLOY-LOGS-073`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `render-latest-deploy-logs-73`
WORKFLOW_POINT: `render-latest-deploy-logs-73`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `7f3f6dd8e425908cd6b73c629e3252254c9f509a`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T13:50:00.000Z`
UPDATED_AT: `2026-04-28T14:06:56.203Z`

---

## Payload

target=latest_deploy
level=all
limit=50
maxLineChars=900
reason=test_improved_latest_deploy_log_window_and_fallback

---

## Last result

Started by github_webhook at 2026-04-28T14:06:56.203Z.

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
