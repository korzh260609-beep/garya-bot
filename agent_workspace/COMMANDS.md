# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PROJECT-MEMORY-7A-WIRING-DIAG-003`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `project-memory-7a-wiring-core-dispatcher-diagnostic`
WORKFLOW_POINT: `project-memory-core-command-wiring-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T00:00:00.000Z`
UPDATED_AT: `2026-04-26T19:11:54.872Z`

---

## Payload

/pm_wiring_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: project-memory-7a-wiring-core-dispatcher-diagnostic
Workflow point: project-memory-core-command-wiring-check
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
