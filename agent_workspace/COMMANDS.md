# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PROJECT-MEMORY-7A-CONTROLLED-WRITE-DIAG-002`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `project-memory-7a-controlled-write-runtime-diagnostic-rerun`
WORKFLOW_POINT: `project-memory-core-controlled-write-path-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T00:00:00.000Z`
UPDATED_AT: `2026-04-26T20:03:44.911Z`

---

## Payload

/pm_controlled_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: project-memory-7a-controlled-write-runtime-diagnostic-rerun
Workflow point: project-memory-core-controlled-write-path-check
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
