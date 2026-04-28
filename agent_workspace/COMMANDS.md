# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-COLLECT-RENDER-REPORT-017`
STATUS: `PENDING`
ACTION: `COLLECT_RENDER_REPORT`
TASK_ID: `repo-state-agent-force-ai-dry-run-diagnose-17`
WORKFLOW_POINT: `repo-state-agent-force-ai-dry-run-render-check-17`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `a31e47e52df3bad2de3f25a7f78fd3d8bdba6ded`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T00:00:00.000Z`
UPDATED_AT: `2026-04-28T00:00:00.000Z`

---

## Payload

collect render report after repo state agent run

---

## Last result

Pending render diagnostics.

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
