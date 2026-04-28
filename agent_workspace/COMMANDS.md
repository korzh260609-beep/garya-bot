# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-064`
STATUS: `RUNNING`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-semantic-map-v3-check-64`
WORKFLOW_POINT: `repo-state-semantic-map-v3-check-64`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `c5248e66e88d6723aeabcd44d4f5f8d3441987a7`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T12:00:00.000Z`
UPDATED_AT: `2026-04-28T11:54:16.493Z`

---

## Payload

-

---

## Last result

Started by github_webhook at 2026-04-28T11:54:16.493Z.

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
