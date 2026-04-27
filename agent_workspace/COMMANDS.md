# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-SCAN-004`
STATUS: `RUNNING`
ACTION: `RUN_REPO_STATE_SCAN`
TASK_ID: `repo-state-agent-runtime-scan-check-2`
WORKFLOW_POINT: `repo-state-agent-map-runtime-check-2`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `4512d6b4cf15ab87f6fb7d54a098498df7b212d1`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-27T16:35:00.000Z`
UPDATED_AT: `2026-04-27T16:04:32.159Z`

---

## Payload

Run RepoStateCollector runtime scan after RUN_REPO_STATE_SCAN allowlist deploy. Verify files/modules/dependencies counts, persistence, scanRunId, and error field.

---

## Last result

Started by github_webhook at 2026-04-27T16:04:32.159Z.

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
