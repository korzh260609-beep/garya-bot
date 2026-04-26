# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `MEMORY-7-9-2-LONG-TERM-READ-001`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `memory-7-9-2-long-term-read`
WORKFLOW_POINT: `confirmed-memory-read-path-runtime-diagnostic`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T17:15:00Z`
UPDATED_AT: `2026-04-26T17:12:03.771Z`

---

## Payload

/memory_long_term_read_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: memory-7-9-2-long-term-read
Workflow point: confirmed-memory-read-path-runtime-diagnostic
Deploy ID: -
Commit: -
Logs: 0
Diagnosis: false
Diagnostic commands: 1
Diagnostics OK: 1
Diagnostics failed: 0

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
