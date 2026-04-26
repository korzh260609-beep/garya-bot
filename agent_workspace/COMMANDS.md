# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `MEMORY-7-9-8-DUPLICATE-CONFLICT-GUARD-001`
STATUS: `PENDING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `memory-7-9-8-duplicate-conflict-guard-confirmed-memory`
WORKFLOW_POINT: `duplicate-conflict-guard-for-confirmed-memory-runtime-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T00:00:00.000Z`
UPDATED_AT: `2026-04-26T00:00:00.000Z`

---

## Payload

/memory_remember_guard_diag

---

## Last result

Pending runtime diagnostic execution.

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
- `COLLECT_RENDER_LOGS`
- `COLLECT_RENDER_DEPLOYS`
- `COLLECT_RENDER_DEPLOY`
- `COLLECT_RENDER_STATUS`
- `WRITE_TEST_NOTE`
- `RUN_DIAGNOSTIC_COMMANDS`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
