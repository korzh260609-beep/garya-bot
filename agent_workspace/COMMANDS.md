# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-LOGS-001`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `render-logs-after-deploy-check`
WORKFLOW_POINT: `repo-state-agent-deploy-log-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T15:30:00.000Z`
UPDATED_AT: `2026-04-27T15:25:33.554Z`

---

## Payload

Collect latest Render logs for garya-bot after the latest deploy. Return recent errors, warnings, startup lines, and deploy-related log lines.

---

## Last result

Action completed: COLLECT_RENDER_LOGS
Task ID: render-logs-after-deploy-check
Workflow point: repo-state-agent-deploy-log-check
Deploy ID: -
Commit: 03f9138cb41aaee15a7953a78818c34bec73f0a9
Required commit: -
Runtime commit: 03f9138cb41aaee15a7953a78818c34bec73f0a9
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
