# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `PM-CAPABILITIES-DIAG-003`
STATUS: `RUNNING`
ACTION: `RUN_DIAGNOSTIC_COMMANDS`
TASK_ID: `7A.13`
WORKFLOW_POINT: `pm-capabilities-diag-chat-capture-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T15:10:00Z`
UPDATED_AT: `2026-04-26T15:07:52.153Z`

---

## Payload

/pm_capabilities_diag

---

## Last result

Started by github_webhook at 2026-04-26T15:07:52.153Z.

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
- `WRITE_TEST_NOTE`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
