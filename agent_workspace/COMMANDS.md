# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-VERIFY-DEPLOY-032`
STATUS: `DONE`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `repo-state-agent-ai-dry-run-env-redeploy-verify-32`
WORKFLOW_POINT: `repo-state-agent-ai-dry-run-env-redeploy-check-32`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `30ec8407d59806282aeed679f5d1c94fc2105781`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T08:43:37.153Z`

---

## Payload

-

---

## Last result

Action completed: VERIFY_DEPLOY
Task ID: repo-state-agent-ai-dry-run-env-redeploy-verify-32
Workflow point: repo-state-agent-ai-dry-run-env-redeploy-check-32
Deploy ID: dep-d7o73uugvqtc73b9d7e0
Commit: 1796c6febcbd4395ef6f7245e60f474687a46d08
Required commit: 30ec8407d59806282aeed679f5d1c94fc2105781
Runtime commit: 1796c6febcbd4395ef6f7245e60f474687a46d08
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
