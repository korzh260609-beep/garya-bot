# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `MEMORY-7-9-1-REMEMBER-GUARD-002`
STATUS: `PENDING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `7.9.1`
WORKFLOW_POINT: `confirmed-facts-write-path-remember-guard-check-after-deploy`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T16:45:00Z`
UPDATED_AT: `2026-04-26T16:45:00Z`

---

## Payload

/memory_remember_guard_diag

---

## Last result

Retry after Render deploy. Expected: new fact stored, duplicate NOOP, conflict blocked, fetch total=1.

---

## Allowed statuses

- `EMPTY`
- `PENDING`
- `RUNNING`
- `DONE`
- `FAILED`
- `IGNORED`

## Allowed actions

- `VERIFY_DEPLOY`
- `COLLECT_RENDER_REPORT`
- `WRITE_TEST_NOTE`
- `RUN_DIAGNOSTIC_COMMANDS`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
