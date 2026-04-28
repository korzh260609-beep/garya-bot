# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-AI-DRY-RUN-033`
STATUS: `PENDING`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-ai-dry-run-after-real-ai-rollback-33`
WORKFLOW_POINT: `repo-state-agent-ai-dry-run-safe-env-check-33`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `1796c6febcbd4395ef6f7245e60f474687a46d08`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:50:00.000Z`
UPDATED_AT: `2026-04-28T08:50:00.000Z`

---

## Payload

```text
forceAiAnalysis=true
```

---

## Last result

-

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

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- `WAITING_DEPLOY` commands are visible but never executed.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
- If `REQUIRES_COMMIT` is set, SG must skip execution until runtime commit matches it.
