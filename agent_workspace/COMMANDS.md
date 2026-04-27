# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-REPORT-001`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_REPORT`
TASK_ID: `render-deploy-startup-lines-check`
WORKFLOW_POINT: `repo-state-agent-deploy-startup-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T15:40:00.000Z`
UPDATED_AT: `2026-04-27T15:28:49.996Z`

---

## Payload

Collect full Render report for garya-bot after latest deploy. Need startup/deploy lines around Deploy live, npm start, node index.js, JobRunner initialized, SG works line, and any SyntaxError, ERR_MODULE_NOT_FOUND, Cannot find module, TypeError, invalid input syntax for type json, relation does not exist.

---

## Last result

Started by github_webhook at 2026-04-27T15:28:49.996Z.

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
