# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-STATUS-002`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `render-status-after-new-deploy-check`
WORKFLOW_POINT: `repo-state-agent-runtime-commit-check-after-new-deploy`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T16:27:24.327Z`

---

## Payload

status check

---

## Last result

Action completed: COLLECT_RENDER_STATUS
Task ID: render-status-after-new-deploy-check
Workflow point: repo-state-agent-runtime-commit-check-after-new-deploy
Deploy ID: -
Commit: 16859c5e59028b9c559641f9ed95f68c4e09e2fb
Required commit: -
Runtime commit: b60647ebfaaec5de15354f0cc7b782f14469678a
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
