# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `MEMORY-7-9-1-REMEMBER-GUARD-001`
STATUS: `FAILED`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `7.9.1`
WORKFLOW_POINT: `confirmed-facts-write-path-remember-guard-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T16:35:00Z`
UPDATED_AT: `2026-04-26T16:27:50.000Z`

---

## Payload

/memory_remember_guard_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: 7.9.1
Workflow point: confirmed-facts-write-path-remember-guard-check
Deploy ID: -
Commit: -
Logs: 0
Diagnosis: false
Diagnostic commands: 1
Diagnostics OK: 0
Diagnostics failed: 1

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

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
