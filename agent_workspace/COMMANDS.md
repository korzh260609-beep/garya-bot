# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-LOGS-001`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `render-logs-after-deploy-check`
WORKFLOW_POINT: `repo-state-agent-deploy-log-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T15:30:00.000Z`
UPDATED_AT: `2026-04-27T15:25:18.030Z`

---

## Payload

Collect latest Render logs for garya-bot after the latest deploy. Return recent errors, warnings, startup lines, and deploy-related log lines.

---

## Last result

Started by github_webhook at 2026-04-27T15:25:18.030Z.

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

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- `WAITING_DEPLOY` commands are visible but never executed.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
- If `REQUIRES_COMMIT` is set, SG must skip execution until runtime commit matches it.
