# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `RENDER-CONTROL-V1-STATUS-002`
STATUS: `FAILED`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `agent-workspace-render-control-v1`
WORKFLOW_POINT: `render-status-check-after-config-runtime-update`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T12:00:00Z`
UPDATED_AT: `2026-04-26T16:49:43.566Z`

---

## Payload

-

---

## Last result

Runner failed: github_http_404: {"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/contents#get-repository-content","status":"404"}

---

## Allowed statuses

- `EMPTY`
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
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
