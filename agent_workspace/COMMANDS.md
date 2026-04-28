# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-DEPLOYS-058`
STATUS: `PENDING`
ACTION: `COLLECT_RENDER_DEPLOYS`
TASK_ID: `repo-state-semantic-map-command-output-deploy-check-58`
WORKFLOW_POINT: `repo-state-semantic-map-command-output-deploy-check-58`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `17c9d90fd1dda58f561d2b05df269a90ca15c0ba`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T11:30:00.000Z`
UPDATED_AT: `2026-04-28T11:30:00.000Z`

---

## Payload

-

---

## Last result

Waiting for SG AgentWorkspaceCommandRunner to collect Render deploy state for semanticMap COMMANDS output patch.

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
