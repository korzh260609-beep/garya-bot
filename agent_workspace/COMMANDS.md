# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-REPO-STATE-SCAN-001`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_SCAN`
TASK_ID: `repo-state-scan-runtime-check`
WORKFLOW_POINT: `repo-state-scan-command-runtime-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `1cf4a28a392513fb1d88b29db4966bc55d400942`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T00:00:00.000Z`
UPDATED_AT: `2026-04-27T13:38:51.487Z`

---

## Payload

-

---

## Last result

Action completed: RUN_REPO_STATE_SCAN
Task ID: repo-state-scan-runtime-check
Workflow point: repo-state-scan-command-runtime-check
Deploy ID: -
Commit: 1cf4a28a392513fb1d88b29db4966bc55d400942
Required commit: 1cf4a28a392513fb1d88b29db4966bc55d400942
Runtime commit: 1cf4a28a392513fb1d88b29db4966bc55d400942
Logs: 0
Diagnosis: false
Diagnostic commands: 0
Diagnostics OK: 0
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
