# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-VERIFY-DEPLOY-027`
STATUS: `DONE`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `repo-state-agent-real-ai-env-redeploy-verify-27`
WORKFLOW_POINT: `repo-state-agent-real-ai-env-redeploy-check-27`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `7e6ac5f628def62a9f3095627519f382cf94e275`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T07:59:13.238Z`

---

## Payload

-

---

## Last result

Action completed: VERIFY_DEPLOY
Task ID: repo-state-agent-real-ai-env-redeploy-verify-27
Workflow point: repo-state-agent-real-ai-env-redeploy-check-27
Deploy ID: dep-d7o6fnu47okc73epa9s0
Commit: ff02516003390a6b80ee88248ab9b57586597f72
Required commit: 7e6ac5f628def62a9f3095627519f382cf94e275
Runtime commit: ff02516003390a6b80ee88248ab9b57586597f72
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
