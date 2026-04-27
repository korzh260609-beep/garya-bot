# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-STATUS-010`
STATUS: `RUNNING`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `render-status-after-agent-layer-filter-deploy`
WORKFLOW_POINT: `repo-state-agent-agent-layer-filter-runtime-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `ddc258e6cff8c3947a42e33c00c845096ea41d88`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T18:41:13.893Z`

---

## Payload

status

---

## Last result

Started by github_webhook at 2026-04-27T18:41:13.893Z.

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
