# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-BOOTSTRAP-DIAG-001`
STATUS: `PENDING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `agentworkspace-bootstrap-reader`
WORKFLOW_POINT: `agentworkspace-bootstrap-read-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `ab4ebdca34ea18368c87a0f9e07607bf1fd3f22d`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T00:00:00.000Z`
UPDATED_AT: `2026-04-27T00:00:00.000Z`

---

## Payload

/agent_bootstrap_diag

---

## Last result

Pending execution after required commit is active in runtime.

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
