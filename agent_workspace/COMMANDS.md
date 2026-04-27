# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-001`
STATUS: `FAILED`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-full-runtime-check`
WORKFLOW_POINT: `repo-state-agent-semantic-map-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `515df4c32c8874505b4ea1eb97d64acda759981e`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T16:45:00.000Z`
UPDATED_AT: `2026-04-27T16:15:58.033Z`

---

## Payload

Run full RepoStateAgentService runtime check: collect technical map, build projectMap, compare signature, check AI semantic map status, and write compact report.

---

## Last result

Runner failed: agent_workspace_action_not_supported:RUN_REPO_STATE_AGENT

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
