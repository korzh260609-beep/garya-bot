# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-007`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-unchanged-after-hash-migration-check-7`
WORKFLOW_POINT: `repo-state-agent-project-map-unchanged-check-7`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `ae8eab1ac2c7fae1da15a88afbcf3e5f9163f0f0`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `2026-04-27T18:09:33.008Z`

---

## Payload

run

---

## Last result

Action completed: RUN_REPO_STATE_AGENT
Task ID: repo-state-agent-unchanged-after-hash-migration-check-7
Workflow point: repo-state-agent-project-map-unchanged-check-7
Deploy ID: -
Commit: ae8eab1ac2c7fae1da15a88afbcf3e5f9163f0f0
Required commit: ae8eab1ac2c7fae1da15a88afbcf3e5f9163f0f0
Runtime commit: ae8eab1ac2c7fae1da15a88afbcf3e5f9163f0f0
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
