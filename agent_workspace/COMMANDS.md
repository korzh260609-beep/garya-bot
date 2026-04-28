# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-VERIFY-DEPLOY-018`
STATUS: `DONE`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `agent-workspace-command-timeout-deploy-verify-18`
WORKFLOW_POINT: `agent-workspace-command-timeout-deploy-check-18`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `82b44cf4e0ff699268c462833ea2d3fa40b21b0c`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T06:54:41.017Z`

---

## Payload

-

---

## Last result

Action completed: VERIFY_DEPLOY
Task ID: agent-workspace-command-timeout-deploy-verify-18
Workflow point: agent-workspace-command-timeout-deploy-check-18
Deploy ID: dep-d7o5h357vvec739i3si0
Commit: 82b44cf4e0ff699268c462833ea2d3fa40b21b0c
Required commit: 82b44cf4e0ff699268c462833ea2d3fa40b21b0c
Runtime commit: 82b44cf4e0ff699268c462833ea2d3fa40b21b0c
Logs: 0
Diagnosis: false
Diagnostic commands: 0
Diagnostics OK: 0
Diagnostics failed: 0

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
