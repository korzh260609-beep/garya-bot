# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-DEPLOYS-050`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_DEPLOYS`
TASK_ID: `repo-state-agent-deploy-check-50`
WORKFLOW_POINT: `repo-state-agent-deploy-check-50`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `84b4fee65b8862acaabddc95fbe48a8129d53e05`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T10:35:00.000Z`
UPDATED_AT: `2026-04-28T10:30:33.121Z`

---

## Payload

-

---

## Last result

Action completed: COLLECT_RENDER_DEPLOYS
Task ID: repo-state-agent-deploy-check-50
Workflow point: repo-state-agent-deploy-check-50
Deploy ID: -
Commit: 84b4fee65b8862acaabddc95fbe48a8129d53e05
Required commit: 84b4fee65b8862acaabddc95fbe48a8129d53e05
Runtime commit: 84b4fee65b8862acaabddc95fbe48a8129d53e05
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
