# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-REAL-AI-031`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-real-ai-retry-after-signature-index-fix-31`
WORKFLOW_POINT: `repo-state-agent-real-ai-signature-index-fix-check-31`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `dbfd67d90da5f24b05db3b8bf6630d90d271a7ad`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T08:31:31.785Z`

---

## Payload

forceAiAnalysis=true

---

## Last result

Action completed: RUN_REPO_STATE_AGENT
Task ID: repo-state-agent-real-ai-retry-after-signature-index-fix-31
Workflow point: repo-state-agent-real-ai-signature-index-fix-check-31
Deploy ID: -
Commit: 30ec8407d59806282aeed679f5d1c94fc2105781
Required commit: dbfd67d90da5f24b05db3b8bf6630d90d271a7ad
Runtime commit: 30ec8407d59806282aeed679f5d1c94fc2105781
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
