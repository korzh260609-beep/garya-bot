# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-AI-DRY-RUN-019`
STATUS: `FAILED`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-force-ai-dry-run-19`
WORKFLOW_POINT: `repo-state-agent-ai-dry-run-force-check-19`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `82b44cf4e0ff699268c462833ea2d3fa40b21b0c`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T06:56:55.155Z`

---

## Payload

forceAiAnalysis=true

---

## Last result

Runner failed: agent_workspace_command_run_repo_state_agent_timeout_after_90000ms

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
