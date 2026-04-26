# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PM-CAPABILITIES-DIAG-002`
STATUS: `FAILED`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `7A.13`
WORKFLOW_POINT: `pm-capabilities-diag-runtime-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T14:55:00Z`
UPDATED_AT: `2026-04-26T14:51:29.229Z`

---

## Payload

/pm_capabilities_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: 7A.13
Workflow point: pm-capabilities-diag-runtime-check
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
