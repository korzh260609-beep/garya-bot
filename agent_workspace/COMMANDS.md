# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-VERIFY-DEPLOY-041`
STATUS: `RUNNING`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `repo-state-agent-explicit-real-ai-action-deploy-41`
WORKFLOW_POINT: `repo-state-agent-explicit-real-ai-action-deploy-check-41`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `e3b37723c1906390119c8e211c4426a9735e402c`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T09:55:00.000Z`
UPDATED_AT: `2026-04-28T09:38:39.045Z`

---

## Payload

-

---

## Last result

Started by github_webhook at 2026-04-28T09:38:39.045Z.

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
