# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `MEMORY-7-9-2-LONG-TERM-READ-001`
STATUS: `RUNNING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `memory-7-9-2-long-term-read`
WORKFLOW_POINT: `confirmed-memory-read-path-runtime-diagnostic`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T17:15:00Z`
UPDATED_AT: `2026-04-26T17:11:52.939Z`

---

## Payload

/memory_long_term_read_diag

---

## Last result

Started by github_webhook at 2026-04-26T17:11:52.939Z.

---

## Allowed statuses

- `EMPTY`
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
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
