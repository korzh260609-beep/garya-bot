# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-AI-DRY-RUN-025`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `agent-workspace-runner-refactor-repo-state-agent-dry-run-25`
WORKFLOW_POINT: `agent-workspace-runner-refactor-repo-state-agent-check-25`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `7e6ac5f628def62a9f3095627519f382cf94e275`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T07:40:10.944Z`

---

## Payload

forceAiAnalysis=true

---

## Last result

Action completed: RUN_REPO_STATE_AGENT
Task ID: agent-workspace-runner-refactor-repo-state-agent-dry-run-25
Workflow point: agent-workspace-runner-refactor-repo-state-agent-check-25
Deploy ID: -
Commit: 7e6ac5f628def62a9f3095627519f382cf94e275
Required commit: 7e6ac5f628def62a9f3095627519f382cf94e275
Runtime commit: 7e6ac5f628def62a9f3095627519f382cf94e275
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
