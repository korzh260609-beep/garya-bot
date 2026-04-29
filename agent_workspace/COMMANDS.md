# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `COLLECT-RENDER-LOGS-HUMAN-MODE-GATE-002`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `collect-render-logs-human-mode-gate-002`
WORKFLOW_POINT: `human-mode-project-repo-gate-diagnosis-unfiltered`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `4516dd382a209775d72c0ced2c3e94235ba2a12f`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-29T09:25:00.000Z`
UPDATED_AT: `2026-04-29T07:18:24.723Z`

---

## Payload

minutes=120
limit=500
maxLineChars=1200
level=all
writeTo=agent_workspace/RENDER_LOGS_REPORT.md

---

## Last result

Started by github_webhook at 2026-04-29T07:18:24.723Z.

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
