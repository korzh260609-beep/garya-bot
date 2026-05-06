# COMMANDS

Current event-driven command for SG workspace runner.

Only one active command is allowed at a time.

---

COMMAND_ID: `render-status-20260506-1105z`
STATUS: `IGNORED`
ACTION: `COLLECT_RENDER_STATUS`
TASK_ID: `manual-render-status-check`
WORKFLOW_POINT: `Agent Workspace + RenderAgent + Render integration skeleton`
DEPLOY_ID: `-`
REQUIRES_COMMIT: `99dfde190ff79c174095ff44739e0e1590fec2b2`
CREATED_BY: `MONARCH_GARY`
CREATED_AT: `2026-05-06T11:05:00Z`
UPDATED_AT: `2026-05-06T12:50:00Z`

---

## Payload

```json
{
  "target": "render_status",
  "mode": "read_only_diagnostics",
  "expected_reports": [
    "agent_workspace/render/RENDER_STATUS_REPORT.md"
  ],
  "notes": [
    "Collect Render integration diagnostics/status only.",
    "Do not perform Render writes or deploy actions.",
    "Do not modify runtime, Telegram, DB, AI, or pillars."
  ]
}
```

---

## Last result

Command ignored by Advisor after PR #106 was merged because `REQUIRES_COMMIT` points to stale runtime commit `99dfde190ff79c174095ff44739e0e1590fec2b2`. No runtime execution was performed.

---

## Allowed statuses

- `EMPTY`
- `PENDING`
- `RUNNING`
- `DONE`
- `FAILED`
- `IGNORED`

## Allowed actions

- `COLLECT_RENDER_ENV_STATUS`
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
- previous stale command is closed as `IGNORED`;
- RenderAgent read-only command routing is connected through `AgentWorkspaceCommandRunner`;
- runtime auto-execution may still be disabled until runtime hooks are explicitly wired/enabled.
