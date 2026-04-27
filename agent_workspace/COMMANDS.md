# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-STATUS-005`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `render-status-after-hash-fix-deploy-check`
WORKFLOW_POINT: `repo-state-agent-hash-fix-runtime-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `299bfba73165dfb32020cc36145784da2f64170e`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T17:34:53.889Z`

---

## Payload

status

---

## Last result

Action completed: COLLECT_RENDER_STATUS
Task ID: render-status-after-hash-fix-deploy-check
Workflow point: repo-state-agent-hash-fix-runtime-check
Deploy ID: -
Commit: 299bfba73165dfb32020cc36145784da2f64170e
Required commit: 299bfba73165dfb32020cc36145784da2f64170e
Runtime commit: 299bfba73165dfb32020cc36145784da2f64170e
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
