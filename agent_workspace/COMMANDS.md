# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-CHECK-053`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_AGENT_REAL_AI`
TASK_ID: `repo-state-agent-check-53`
WORKFLOW_POINT: `repo-state-agent-check-53`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `48812214c7bdfe52302a6cfdd3b25468a67d3ae6`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T11:05:00.000Z`
UPDATED_AT: `2026-04-28T10:52:39.696Z`

---

## Payload

-

---

## Last result

Action completed: RUN_REPO_STATE_AGENT_REAL_AI
Task ID: repo-state-agent-check-53
Workflow point: repo-state-agent-check-53
Deploy ID: -
Commit: 48812214c7bdfe52302a6cfdd3b25468a67d3ae6
Required commit: 48812214c7bdfe52302a6cfdd3b25468a67d3ae6
Runtime commit: 48812214c7bdfe52302a6cfdd3b25468a67d3ae6
Logs: 0
Diagnosis: false
Diagnostic commands: 0
Diagnostics OK: 0
Diagnostics failed: 0
Result status: REAL_AI_BLOCKED
Blocked: yes
Block reason: missing_allow_real_ai
Tokens spent: no
AI fallback used: no
AI pricing configured: no
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
