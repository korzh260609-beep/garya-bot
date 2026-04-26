# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `MEMORY-7-9-6-MONARCH-MEMORY-DIAG-001`
STATUS: `FAILED`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `memory-7-9-6-monarch-memory-diagnostics`
WORKFLOW_POINT: `monarch-memory-diagnostics-runtime-command`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T18:32:14.000Z`
UPDATED_AT: `2026-04-26T18:33:58.190Z`

---

## Payload

/memory_monarch_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: memory-7-9-6-monarch-memory-diagnostics
Workflow point: monarch-memory-diagnostics-runtime-command
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
