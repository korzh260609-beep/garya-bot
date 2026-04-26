# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `VERIFY-TEST-002`
STATUS: `RUNNING`
ACTION: `VERIFY_DEPLOY`
TASK_ID: `TEST-002`
WORKFLOW_POINT: `webhook-auto-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T14:22:00Z`
UPDATED_AT: `2026-04-26T14:21:40.268Z`

---

## Payload

Проверка полной event-driven схемы: advisor writes COMMANDS.md → GitHub webhook → SG reads command → SG resets stale reports → SG collects RenderBridge data → SG writes fresh workspace reports → advisor reads result.

---

## Last result

Started by github_webhook at 2026-04-26T14:21:40.268Z.

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
