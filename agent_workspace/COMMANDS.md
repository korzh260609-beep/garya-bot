# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-DEPLOYS-056`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_DEPLOYS`
TASK_ID: `repo-state-status-semantics-deploy-check-56`
WORKFLOW_POINT: `repo-state-status-semantics-deploy-check-56`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `706bb8e1cec419fbfc495a546a7a241140322f39`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T11:20:00.000Z`
UPDATED_AT: `2026-04-28T11:09:32.105Z`

---

## Payload

-

---

## Last result

Action completed: COLLECT_RENDER_DEPLOYS
Task ID: repo-state-status-semantics-deploy-check-56
Workflow point: repo-state-status-semantics-deploy-check-56
Deploy ID: -
Commit: 706bb8e1cec419fbfc495a546a7a241140322f39
Required commit: 706bb8e1cec419fbfc495a546a7a241140322f39
Runtime commit: 706bb8e1cec419fbfc495a546a7a241140322f39
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
