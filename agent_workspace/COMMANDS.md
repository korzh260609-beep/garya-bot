# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-010`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-agent-layer-filter-check-10`
WORKFLOW_POINT: `repo-state-agent-agent-layer-filter-signature-check-10`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `ddc258e6cff8c3947a42e33c00c845096ea41d88`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T18:45:24.510Z`

---

## Payload

run

---

## Last result

Action completed: RUN_REPO_STATE_AGENT
Task ID: repo-state-agent-agent-layer-filter-check-10
Workflow point: repo-state-agent-agent-layer-filter-signature-check-10
Deploy ID: -
Commit: ddc258e6cff8c3947a42e33c00c845096ea41d88
Required commit: ddc258e6cff8c3947a42e33c00c845096ea41d88
Runtime commit: ddc258e6cff8c3947a42e33c00c845096ea41d88
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
