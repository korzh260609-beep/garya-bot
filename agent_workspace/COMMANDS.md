# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `NONE`
STATUS: `EMPTY`
ACTION: `NONE`
TASK_ID: `-`
WORKFLOW_POINT: `-`
DEPLOY_ID: `-`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `-`

---

## Payload

-

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
