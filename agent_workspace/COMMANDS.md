# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-REPO-STATE-SCAN-DIAG-001`
STATUS: `FAILED`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `repo-state-scan-runtime-check`
WORKFLOW_POINT: `repo-state-scan-command-runtime-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `77181f830ef9b57b06c44c13918448132a71e577`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T00:00:00.000Z`
UPDATED_AT: `2026-04-27T13:13:45.649Z`

---

## Payload

/repo_state_scan

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: repo-state-scan-runtime-check
Workflow point: repo-state-scan-command-runtime-check
Deploy ID: -
Commit: 77181f830ef9b57b06c44c13918448132a71e577
Required commit: 77181f830ef9b57b06c44c13918448132a71e577
Runtime commit: 77181f830ef9b57b06c44c13918448132a71e577
Logs: 0
Diagnosis: false
Diagnostic commands: 1
Diagnostics OK: 0
Diagnostics failed: 1

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
