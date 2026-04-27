# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-STATUS-011`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `render-status-after-normalized-signature-deploy`
WORKFLOW_POINT: `repo-state-agent-normalized-signature-runtime-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `49fb0cc634858c73424c4749757450e3e0c41775`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T18:55:24.177Z`

---

## Payload

status

---

## Last result

Action completed: COLLECT_RENDER_STATUS
Task ID: render-status-after-normalized-signature-deploy
Workflow point: repo-state-agent-normalized-signature-runtime-check
Deploy ID: -
Commit: 49fb0cc634858c73424c4749757450e3e0c41775
Required commit: 49fb0cc634858c73424c4749757450e3e0c41775
Runtime commit: 49fb0cc634858c73424c4749757450e3e0c41775
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
