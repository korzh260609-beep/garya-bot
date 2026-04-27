# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-STATUS-001`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `render-status-before-repo-state-agent-retry`
WORKFLOW_POINT: `repo-state-agent-deploy-readiness-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T16:55:00.000Z`
UPDATED_AT: `2026-04-27T16:20:51.354Z`

---

## Payload

Collect Render status and latest deploy before retrying RUN_REPO_STATE_AGENT. Need latest deploy id, latest commit, status, and RenderBridge readiness.

---

## Last result

Started by github_webhook at 2026-04-27T16:20:51.354Z.

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
