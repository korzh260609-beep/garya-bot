# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PROJECT-MEMORY-7A-PM-CONTEXT-DIAG-001`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `project-memory-7a-pm-context-diagnostic`
WORKFLOW_POINT: `project-memory-core-context-restore-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `b2c3435e573d3343109f4ccda19d1da03d1e239c`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T00:00:00.000Z`
UPDATED_AT: `2026-04-27T02:46:58.728Z`

---

## Payload

/pm_context_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: project-memory-7a-pm-context-diagnostic
Workflow point: project-memory-core-context-restore-check
Deploy ID: -
Commit: b2c3435e573d3343109f4ccda19d1da03d1e239c
Required commit: b2c3435e573d3343109f4ccda19d1da03d1e239c
Runtime commit: b2c3435e573d3343109f4ccda19d1da03d1e239c
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
