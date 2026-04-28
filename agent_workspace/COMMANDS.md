# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-036`
STATUS: `DONE`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-check-36`
WORKFLOW_POINT: `repo-state-agent-check-36`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `645ab3f26875545ba12a7b797f1923143abd085e`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T09:18:00.000Z`
UPDATED_AT: `2026-04-28T09:10:59.286Z`

---

## Payload

```text
forceAiAnalysis=true
```

---

## Last result

Action completed: RUN_REPO_STATE_AGENT
Task ID: repo-state-agent-check-36
Workflow point: repo-state-agent-check-36
Deploy ID: -
Commit: 645ab3f26875545ba12a7b797f1923143abd085e
Required commit: 645ab3f26875545ba12a7b797f1923143abd085e
Runtime commit: 645ab3f26875545ba12a7b797f1923143abd085e
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
