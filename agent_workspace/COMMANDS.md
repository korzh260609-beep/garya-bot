# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-DIAG-RUNTIME-CONFIG-001`
STATUS: `DONE`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `runtime-agent-workspace-config-diag`
WORKFLOW_POINT: `repo-state-agent-runtime-allowed-actions-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `16f041dc548cb90c3d491b7fce5d1b50f71bffe4`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T17:06:56.027Z`

---

## Payload

/agent_workspace_diag

---

## Last result

Action completed: RUN_DIAGNOSTIC_COMMANDS
Task ID: runtime-agent-workspace-config-diag
Workflow point: repo-state-agent-runtime-allowed-actions-check
Deploy ID: -
Commit: 16f041dc548cb90c3d491b7fce5d1b50f71bffe4
Required commit: 16f041dc548cb90c3d491b7fce5d1b50f71bffe4
Runtime commit: 16f041dc548cb90c3d491b7fce5d1b50f71bffe4
Logs: 0
Diagnosis: false
Diagnostic commands: 1
Diagnostics OK: 1
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
