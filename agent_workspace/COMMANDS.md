# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-055`
STATUS: `PENDING`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-semantic-map-check-55`
WORKFLOW_POINT: `repo-state-semantic-map-check-55`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `32e263c8e9dc284cdbb99ea0f1dfa7662ae63e2d`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T11:15:00.000Z`
UPDATED_AT: `2026-04-28T11:15:00.000Z`

---

## Payload

-

---

## Last result

Waiting for SG AgentWorkspaceCommandRunner to verify deterministic semanticMap fields without real AI spending.

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
