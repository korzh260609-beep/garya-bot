# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `COLLECT-RENDER-LOGS-HUMAN-MODE-GATE-001`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_LOGS`
TASK_ID: `collect-render-logs-human-mode-gate-001`
WORKFLOW_POINT: `human-mode-project-repo-gate-diagnosis`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `4516dd382a209775d72c0ced2c3e94235ba2a12f`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-29T09:00:00.000Z`
UPDATED_AT: `2026-04-29T07:16:46.477Z`

---

## Payload

limit=300
lookFor=HUMAN_MODE_GATE_STATUS,TelegramAdapter attached,HUMAN_MODE_PROJECT_REPO_DRY_RUN,handleMessage(core),TelegramAdapter message handler failed,ENFORCED_DROP_NO_DEDUPE,ENFORCED_DROP_DUPLICATE,Transport enforced,messageRouter
writeTo=agent_workspace/RENDER_LOGS_REPORT.md

---

## Last result

Action completed: COLLECT_RENDER_LOGS
Task ID: collect-render-logs-human-mode-gate-001
Workflow point: human-mode-project-repo-gate-diagnosis
Deploy ID: -
Commit: 4516dd382a209775d72c0ced2c3e94235ba2a12f
Required commit: 4516dd382a209775d72c0ced2c3e94235ba2a12f
Runtime commit: 4516dd382a209775d72c0ced2c3e94235ba2a12f
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
