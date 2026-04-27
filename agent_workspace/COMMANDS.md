# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-LOGS-006`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `render-logs-after-project-map-hash-migration`
WORKFLOW_POINT: `repo-state-agent-hash-migration-log-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `ae8eab1ac2c7fae1da15a88afbcf3e5f9163f0f0`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T18:00:31.461Z`

---

## Payload

target=latest_deploy level=all limit=120 minutes=60

---

## Last result

Started by github_webhook at 2026-04-27T18:00:31.461Z.

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
