# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-VERIFY-DEPLOY-014`
STATUS: `RUNNING`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `agent-workspace-refactor-deploy-verify-14`
WORKFLOW_POINT: `agent-workspace-helper-refactor-deploy-check-14`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `fdb3412b00475c4f4dde316972d6e0971cad053f`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T00:00:00.000Z`
UPDATED_AT: `2026-04-28T06:08:47.714Z`

---

## Payload

verify deployed commit after AgentWorkspace helper refactor preparation

---

## Last result

Started by github_webhook at 2026-04-28T06:08:47.714Z.

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
