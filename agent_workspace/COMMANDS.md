# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-SCAN-003`
STATUS: `FAILED`
ACTION: `RUN_REPO_STATE_SCAN`
TASK_ID: `repo-state-agent-runtime-scan-check`
WORKFLOW_POINT: `repo-state-agent-map-runtime-check`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `818bb8b55399387645bf955cf9217ec706fa70d8`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T16:25:00.000Z`
UPDATED_AT: `2026-04-27T15:59:48.017Z`

---

## Payload

Run RepoStateCollector runtime scan and persist the technical project map evidence. Verify files/modules/dependencies counts, persistence, scanRunId, and error field.

---

## Last result

Action is not allowed: RUN_REPO_STATE_SCAN

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
