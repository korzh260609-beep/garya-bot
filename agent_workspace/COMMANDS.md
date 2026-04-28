# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-DEPLOYS-039`
STATUS: `DONE`
ACTION: `COLLECT_RENDER_DEPLOYS`
TASK_ID: `check-render-deploys-after-real-ai-gate-39`
WORKFLOW_POINT: `render-deploys-check-after-real-ai-gate-39`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T09:40:00.000Z`
UPDATED_AT: `2026-04-28T09:29:56.584Z`

---

## Payload

```text
limit=10
```

---

## Last result

Action completed: COLLECT_RENDER_DEPLOYS
Task ID: check-render-deploys-after-real-ai-gate-39
Workflow point: render-deploys-check-after-real-ai-gate-39
Deploy ID: -
Commit: ec5e97664a429f06fa9516842f01fe92c9cd2850
Required commit: -
Runtime commit: ec5e97664a429f06fa9516842f01fe92c9cd2850
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
