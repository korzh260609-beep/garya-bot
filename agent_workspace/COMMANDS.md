# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-BOOTSTRAP-SAFETY-DIAG-002`
STATUS: `RUNNING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `agentworkspace-bootstrap-safety-check`
WORKFLOW_POINT: `agentworkspace-post-deploy-bootstrap-safety-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `b15bb1f381d1ac96d0bb6ee7e0453148cfde710e`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T00:00:00.000Z`
UPDATED_AT: `2026-04-27T06:07:24.957Z`

---

## Payload

/agent_bootstrap_diag
/agent_bootstrap_strict_diag

---

## Last result

Started by github_webhook at 2026-04-27T06:07:24.957Z.

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
