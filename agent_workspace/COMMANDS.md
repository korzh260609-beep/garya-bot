# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PROJECT-MEMORY-7A-PM-FIND-DIAG-001`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `project-memory-7a-pm-find-runtime-diagnostic`
WORKFLOW_POINT: `project-memory-core-pm-find-readonly-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `60ad2a30b2df7e96340055d483dd998b27b62391`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T00:00:00.000Z`
UPDATED_AT: `2026-04-27T02:23:17.645Z`

---

## Payload

/pm_find_diag Runtime

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: project-memory-7a-pm-find-runtime-diagnostic
Workflow point: project-memory-core-pm-find-readonly-check
Deploy ID: -
Commit: 5602534fbc137efc2b0d7d1cce011077bb91d8e7
Required commit: 60ad2a30b2df7e96340055d483dd998b27b62391
Runtime commit: 5602534fbc137efc2b0d7d1cce011077bb91d8e7
Logs: 0
Diagnosis: false
Diagnostic commands: 1
Diagnostics OK: 1
Diagnostics failed: 0

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
