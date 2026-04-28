# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-REAL-AI-028`
STATUS: `FAILED`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-real-ai-first-run-28`
WORKFLOW_POINT: `repo-state-agent-real-ai-first-run-check-28`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `ff02516003390a6b80ee88248ab9b57586597f72`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T08:03:05.319Z`

---

## Payload

forceAiAnalysis=true

---

## Last result

Runner failed: index row size 3152 exceeds btree version 4 maximum 2704 for index "repo_state_ai_analysis_project_map_signature_index"

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
