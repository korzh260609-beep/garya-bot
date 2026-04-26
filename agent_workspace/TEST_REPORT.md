# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `7.9.1`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-26T16:22:14.054Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/render_bridge_logs
/render_bridge_diagnose
/agent_workspace_diag
```

## Expected answers

The runner must execute allowlisted SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/render_bridge_logs: FAILED
/render_bridge_diagnose: OK
/agent_workspace_diag: OK
```

## Chat response logs

```text
## /render_bridge_logs
-

## /render_bridge_diagnose
-

## /agent_workspace_diag
-
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_FAILED`

## Notes

## /render_bridge_logs
ok=false
handler=-
error=The operation was aborted.
```json
{}
```

## /render_bridge_diagnose
ok=true
handler=-
error=-
```json
{
  "ok": true,
  "taskId": "diagnostic",
  "workflowPoint": "render-bridge-diagnose",
  "deployId": "dep-d7n3lihj2pic738j6a8g",
  "commit": "648bd962119168220e5dcadf596f9cf9af78628b",
  "logs": 0,
  "diagnosis": false,
  "writes": [
    {
      "ok": true,
      "dryRun": false,
      "fileName": "DEPLOY_REPORT.md",
      "path": "agent_workspace/DEPLOY_REPORT.md",
      "commitSha": "a8aeca90d6c571a662e9a6c3ec562464c17100e9"
    },
    {
      "ok": true,
      "dryRun": false,
      "fileName": "RENDER_REPORT.md",
      "path": "agent_workspace/RENDER_REPORT.md",
      "commitSha": "c2a9017ecd012fe56c3fe6b7f7662aa596e8e7f8"
    },
    {
      "ok": true,
      "dryRun": false,
      "fileName": "STATUS.md",
      "path": "agent_workspace/STATUS.md",
      "commitSha": "c740539859ac8605899862884b322a3d75014c9f"
    },
    {
      "ok": true,
      "dryRun": false,
      "fileName": "LOOP_STATE.md",
      "path": "agent_workspace/LOOP_STATE.md",
      "commitSha": "211bbef4dce99dc392b9e80332acccf72a8a46dc"
    }
  ]
}
```

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
    "DIAGNOSIS.md",
    "TEST_REPORT.md",
    "PATCH_REQUESTS.md"
  ],
  "allowedActions": [
    "VERIFY_DEPLOY",
    "COLLECT_RENDER_REPORT",
    "WRITE_TEST_NOTE",
    "RUN_DIAGNOSTIC_COMMANDS"
  ],
  "allowedDiagnosticCommands": [
    "/agent_workspace_diag",
    "/render_bridge_diag",
    "/render_bridge_services",
    "/render_bridge_deploys",
    "/render_bridge_logs",
    "/render_bridge_diagnose",
    "/pm_capabilities_diag"
  ]
}
```
