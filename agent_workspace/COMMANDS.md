# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-VERIFY-DEPLOY-015`
STATUS: `DONE`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `agent-workspace-command-runner-refactor-deploy-verify-15`
WORKFLOW_POINT: `agent-workspace-command-runner-refactor-deploy-check-15`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `a31e47e52df3bad2de3f25a7f78fd3d8bdba6ded`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T00:00:00.000Z`
UPDATED_AT: `2026-04-28T06:43:12.549Z`

---

## Payload

verify deployed commit after command runner refactor

---

## Last result

Action completed: VERIFY_DEPLOY
Task ID: agent-workspace-command-runner-refactor-deploy-verify-15
Workflow point: agent-workspace-command-runner-refactor-deploy-check-15
Deploy ID: dep-d7o5ct2qqhas738a771g
Commit: a31e47e52df3bad2de3f25a7f78fd3d8bdba6ded
Required commit: a31e47e52df3bad2de3f25a7f78fd3d8bdba6ded
Runtime commit: a31e47e52df3bad2de3f25a7f78fd3d8bdba6ded
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
