# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-LATEST-DEPLOY-LOGS-003`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `latest-deploy-after-normalizer-fix-check`
WORKFLOW_POINT: `render-deploy-after-normalizer-fix-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `818bb8b55399387645bf955cf9217ec706fa70d8`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T16:15:00.000Z`
UPDATED_AT: `2026-04-27T15:56:21.153Z`

---

## Payload

target=latest_deploy
level=all
limit=300
maxLineChars=1200

---

## Last result

Started by github_webhook at 2026-04-27T15:56:21.153Z.

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
