# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-LOGS-029`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `repo-state-agent-migration-render-logs-check-29`
WORKFLOW_POINT: `repo-state-agent-signature-hash-migration-logs-check-29`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T08:17:26.525Z`

---

## Payload

-

---

## Last result

Action completed: COLLECT_RENDER_LOGS
Task ID: repo-state-agent-migration-render-logs-check-29
Workflow point: repo-state-agent-signature-hash-migration-logs-check-29
Deploy ID: -
Commit: dbfd67d90da5f24b05db3b8bf6630d90d271a7ad
Required commit: -
Runtime commit: dbfd67d90da5f24b05db3b8bf6630d90d271a7ad
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
