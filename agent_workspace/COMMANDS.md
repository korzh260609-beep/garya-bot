# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-LATEST-DEPLOY-LOGS-001`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `latest-deploy-error-root-cause-check`
WORKFLOW_POINT: `render-latest-deploy-error-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T15:55:00.000Z`
UPDATED_AT: `2026-04-27T15:46:01.560Z`

---

## Payload

target=latest_deploy
level=all
limit=300
maxLineChars=1200

---

## Last result

Action completed: COLLECT_RENDER_LOGS
Task ID: latest-deploy-error-root-cause-check
Workflow point: render-latest-deploy-error-check
Deploy ID: -
Commit: 03f9138cb41aaee15a7953a78818c34bec73f0a9
Required commit: -
Runtime commit: 03f9138cb41aaee15a7953a78818c34bec73f0a9
Logs: 15
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
