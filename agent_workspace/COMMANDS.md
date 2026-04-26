# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `VERIFY-TEST-003`
STATUS: `PENDING`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `TEST-003`
WORKFLOW_POINT: `webhook-auto-check-after-fix`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T14:40:00Z`
UPDATED_AT: `2026-04-26T14:40:00Z`

---

## Payload

Проверка полной event-driven схемы после фикса runner: advisor writes COMMANDS.md → GitHub webhook → SG reads command → SG resets stale reports → SG collects RenderBridge data → SG writes fresh workspace reports → SG marks COMMANDS.md DONE or FAILED.

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
