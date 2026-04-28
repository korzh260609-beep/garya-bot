# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-CHECK-049`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_AGENT_REAL_AI`
TASK_ID: `repo-state-agent-check-49`
WORKFLOW_POINT: `repo-state-agent-check-49`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `c5eedec9fa8c03978ceb84c2d958ba06d9ffb6c1`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T11:25:00.000Z`
UPDATED_AT: `2026-04-28T10:24:46.149Z`

---

## Payload

-

---

## Last result

Action completed: RUN_REPO_STATE_AGENT_REAL_AI
Task ID: repo-state-agent-check-49
Workflow point: repo-state-agent-check-49
Deploy ID: -
Commit: c5eedec9fa8c03978ceb84c2d958ba06d9ffb6c1
Required commit: c5eedec9fa8c03978ceb84c2d958ba06d9ffb6c1
Runtime commit: c5eedec9fa8c03978ceb84c2d958ba06d9ffb6c1
Logs: 0
Diagnosis: false
Diagnostic commands: 0
Diagnostics OK: 0
Diagnostics failed: 0
Tokens spent: no
AI source: dry_run
Allow real AI: no
Real AI blocked: yes

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
- `RUN_REPO_STATE_SCAN`
- `RUN_REPO_STATE_AGENT`
- `RUN_REPO_STATE_AGENT_REAL_AI`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- `WAITING_DEPLOY` commands are visible but never executed.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
- If `REQUIRES_COMMIT` is set, SG must skip execution until runtime commit matches it.
