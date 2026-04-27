# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `runtime-agent-workspace-config-diag`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T17:06:54.828Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/agent_workspace_diag
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/agent_workspace_diag: OK
```

## Chat response logs

```text
## /agent_workspace_diag
-
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_OK`

## Notes

## /agent_workspace_diag
ok=true
handler=-
error=-
```json
{
  "enabled": true,
  "dryRun": false,
  "webhookEnabled": true,
  "webhookReady": true,
  "chaosDiagEnabled": false,
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "basePath": "agent_workspace",
  "hasGithubToken": true,
  "hasWebhookToken": true,
  "ready": true,
  "allowedFiles": [
    "COMMANDS.md",
    "INBOX.md",
    "STATUS.md",
    "LOOP_STATE.md",
    "DEPLOY_REPORT.md",
    "RENDER_REPORT.md",
    "RENDER_LOGS_REPORT.md",
    "RENDER_DEPLOYS_REPORT.md",
    "RENDER_DEPLOY_REPORT.md",
    "RENDER_STATUS_REPORT.md",
    "DIAGNOSIS.md",
    "TEST_REPORT.md",
    "PATCH_REQUESTS.md"
  ],
  "allowedActions": [
    "VERIFY_DEPLOY",
    "COLLECT_RENDER_REPORT",
    "COLLECT_RENDER_LOGS",
    "COLLECT_RENDER_DEPLOYS",
    "COLLECT_RENDER_DEPLOY",
    "COLLECT_RENDER_STATUS",
    "WRITE_TEST_NOTE",
    "RUN_DIAGNOSTIC_COMMANDS",
    "RUN_REPO_STATE_SCAN",
    "RUN_REPO_STATE_AGENT"
  ],
  "allowedDiagnosticCommands": [
    "/agent_workspace_diag",
    "/render_bridge_diag",
    "/render_bridge_services",
    "/render_bridge_deploys",
    "/render_bridge_logs",
    "/render_bridge_diagnose",
    "/pm_capabilities_diag",
    "/pm_wiring_diag",
    "/memory_monarch_diag"
  ],
  "diagnosticDenyTokens": [
    "write",
    "set",
    "update",
    "delete",
    "remove",
    "archive",
    "remember",
    "restore",
    "backfill",
    "reclassify",
    "run",
    "stop",
    "new",
    "confirm",
    "link",
    "release",
    "refund",
    "clear",
    "reset",
    "sync",
    "upsert",
    "create"
  ]
}
```
