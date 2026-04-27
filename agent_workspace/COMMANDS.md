# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PROJECT-MEMORY-7A-PM-SHADOW-CONTEXT-DIAG-001`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `project-memory-7a-shadow-restore-diagnostic`
WORKFLOW_POINT: `project-memory-core-shadow-context-restore-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `602536f7cb6c7e86c80957bacf33dc666c876734`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T00:00:00.000Z`
UPDATED_AT: `2026-04-27T03:02:09.390Z`

---

## Payload

/pm_shadow_context_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: project-memory-7a-shadow-restore-diagnostic
Workflow point: project-memory-core-shadow-context-restore-check
Deploy ID: -
Commit: ef12b104575ef2d95ca0797c3b1347855b503d41
Required commit: 602536f7cb6c7e86c80957bacf33dc666c876734
Runtime commit: ef12b104575ef2d95ca0797c3b1347855b503d41
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
