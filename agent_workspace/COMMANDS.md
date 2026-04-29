# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `COLLECT-RENDER-LOGS-HUMAN-MODE-HANDOFF-001`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `collect-render-logs-human-mode-handoff-001`
WORKFLOW_POINT: `human-mode-project-repo-response-handoff-diagnosis`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `12b1d24c9195cfa5096f88b7d64365260b1a39a2`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-29T17:10:00.000Z`
UPDATED_AT: `2026-04-29T14:12:18.997Z`

---

## Payload

minutes=30
limit=300
maxLineChars=1600
level=all
writeTo=agent_workspace/RENDER_LOGS_REPORT.md

---

## Last result

Started by github_webhook at 2026-04-29T14:12:18.997Z.

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
