# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `VERIFY-PM-CAPABILITIES-DIAG-001`
STATUS: `PENDING`
ACTION: `WRITE_TEST_NOTE`
TASK_ID: `7A.13`
WORKFLOW_POINT: `pm-capabilities-diag-runtime-check`
DEPLOY_ID: `-`
CREATED_BY: `advisor`
CREATED_AT: `2026-04-26T14:45:00Z`
UPDATED_AT: `-`

---

## Payload

Requested command test: `/pm_capabilities_diag`

Expected diagnostic output:
- validation: OK
- dbWrites: no
- advisoryOnly: yes
- sourceOfTruth: repo/runtime/tests
- capabilities: 3
- commands: 10
- files: 12
- errors: none
- Result: read-only path active.

Important limitation: current AgentWorkspace runner action is WRITE_TEST_NOTE. It records this requested test into TEST_REPORT.md. It does not yet execute Telegram command handlers directly.

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

## Allowed actions

- `VERIFY_DEPLOY`
- `COLLECT_RENDER_REPORT`
- `WRITE_TEST_NOTE`

## Hard limits

- SG runs only `STATUS: PENDING` commands.
- SG ignores already completed commands.
- SG never writes code or pillars from this command file.
- SG updates only allowlisted files in `agent_workspace/`.
