# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `NONE`
STATUS: `EMPTY`
ACTION: `NONE`
TASK_ID: `manual`
WORKFLOW_POINT: `-`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `-`
CREATED_BY: `-`
CREATED_AT: `-`
UPDATED_AT: `-`

---

## Payload

-

---

## Last result

-

---

## Allowed statuses

- `EMPTY`
- `PENDING`
- `RUNNING`
- `DONE`
- `FAILED`
- `IGNORED`

## Planned allowed actions

- `COLLECT_RENDER_LOGS`
- `COLLECT_RENDER_DEPLOYS`
- `COLLECT_RENDER_DEPLOY`
- `COLLECT_RENDER_STATUS`

## Hard limits

- SG must run only `STATUS: PENDING` commands.
- SG must ignore already completed commands.
- SG must not write code or pillars from this command file.
- SG must update only allowlisted files in `agent_workspace/`.
- `COMMANDS.md` must not be auto-cleared by the workspace cleaner.
- If `REQUIRES_COMMIT` is set, SG must skip execution until runtime commit matches it.

Current SG 2.0 status:
- skeleton only;
- no runtime runner is connected yet.
