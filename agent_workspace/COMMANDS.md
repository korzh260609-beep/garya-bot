# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-VERIFY-DEPLOY-020`
STATUS: `DONE`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `agent-workspace-command-timeout-240s-deploy-verify-20`
WORKFLOW_POINT: `agent-workspace-command-timeout-240s-deploy-check-20`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `e07174db425ae51ae9e4b621fb343d362bfe1d1b`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T07:04:09.821Z`

---

## Payload

-

---

## Last result

Action completed: VERIFY_DEPLOY
Task ID: agent-workspace-command-timeout-240s-deploy-verify-20
Workflow point: agent-workspace-command-timeout-240s-deploy-check-20
Deploy ID: dep-d7o5mm9j2pic739l4lrg
Commit: e07174db425ae51ae9e4b621fb343d362bfe1d1b
Required commit: e07174db425ae51ae9e4b621fb343d362bfe1d1b
Runtime commit: e07174db425ae51ae9e4b621fb343d362bfe1d1b
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
