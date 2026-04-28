# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `RAW-RENDER-LAST-50-002`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `raw-render-last-50-002`
WORKFLOW_POINT: `raw-render-last-50-002`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `2635de6fd07de262d636fca2591ce129b2c3e4d9`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T14:55:00.000Z`
UPDATED_AT: `2026-04-28T14:45:25.919Z`

---

## Payload

/render_bridge_logs 50

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: raw-render-last-50-002
Workflow point: raw-render-last-50-002
Deploy ID: -
Commit: 2635de6fd07de262d636fca2591ce129b2c3e4d9
Required commit: 2635de6fd07de262d636fca2591ce129b2c3e4d9
Runtime commit: 2635de6fd07de262d636fca2591ce129b2c3e4d9
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
- `RUN_REPO_STATE_SCAN`
- `RUN_REPO_STATE_AGENT`
- `RUN_REPO_STATE_AGENT_REAL_AI`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- `WAITING_DEPLOY` commands are visible but never executed.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
- If `REQUIRES_COMMIT` is set, SG must skip execution until runtime commit matches it.
