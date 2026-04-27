# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PROJECT-MEMORY-7A-PM-SHADOW-FILL-DIAG-001`
STATUS: `PENDING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `project-memory-7a-shadow-fill-diagnostic`
WORKFLOW_POINT: `project-memory-core-shadow-fill-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `63c36122af847e2cf9f2b5beeb263ba8ab8f84f7`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T00:00:00.000Z`
UPDATED_AT: `2026-04-27T00:00:00.000Z`

---

## Payload

/pm_shadow_fill_diag

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
