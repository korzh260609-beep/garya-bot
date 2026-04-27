# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-STATUS-008`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `render-status-after-workspace-signature-filter-deploy`
WORKFLOW_POINT: `repo-state-agent-workspace-signature-filter-runtime-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `7218fe969f1ec03400446c3cf727ac5382eb7e03`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T18:18:11.284Z`

---

## Payload

status

---

## Last result

Action completed: COLLECT_RENDER_STATUS
Task ID: render-status-after-workspace-signature-filter-deploy
Workflow point: repo-state-agent-workspace-signature-filter-runtime-check
Deploy ID: -
Commit: 7218fe969f1ec03400446c3cf727ac5382eb7e03
Required commit: 7218fe969f1ec03400446c3cf727ac5382eb7e03
Runtime commit: 7218fe969f1ec03400446c3cf727ac5382eb7e03
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
