# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `AGENTWORKSPACE-RUN-REPO-STATE-AGENT-AI-DRY-RUN-023`
STATUS: `PENDING`
ACTION: `RUN_REPO_STATE_AGENT`
TASK_ID: `repo-state-agent-compact-ai-prompt-dry-run-23`
WORKFLOW_POINT: `repo-state-agent-compact-ai-prompt-force-check-23`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `69fdec9fe312fc850004910869b9e59e42798687`
CREATED_BY: `SG-advisor`
CREATED_AT: `2026-04-28T08:00:00.000Z`
UPDATED_AT: `2026-04-28T08:00:00.000Z`

---

## Payload

forceAiAnalysis=true

---

## Last result

Pending forced RepoStateAgent AI dry-run after compact AI prompt payload deployment.

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
