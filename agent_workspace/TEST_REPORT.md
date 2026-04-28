# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `agent-workspace-runner-refactor-diagnostic-executor-test-26`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T07:41:46.783Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/agent_workspace_diag
/agent_bootstrap_diag
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/agent_workspace_diag: OK
/agent_bootstrap_diag: OK
```

## Chat response logs

```text
## /agent_workspace_diag
-

## /agent_bootstrap_diag
🧭 AgentWorkspace bootstrap diag

readOnly: yes
dbWrites: no
aiCalls: no
touchesPillars: no
runtimePromptChanged: no

repoFullName: korzh260609-beep/garya-bot
branch: main
filesExpected: 5
filesOk: 5
filesFailed: 0

OK: AGENTS.md chars=4238 hash=25443467
OK: agent_workspace/START_HERE.md chars=1068 hash=f4ece390
OK: agent_workspace/ADVISOR_PROTOCOL.md chars=5010 hash=73152852
OK: agent_workspace/COMMANDS.md chars=1388 hash=65c05d66
OK: agent_workspace/TEST_REPORT.md chars=220 hash=13afed20

warnings: -

Result: OK
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

## /agent_bootstrap_diag
ok=true
handler=-
error=-
```json
{
  "ok": true,
  "readOnly": true,
  "dbWrites": false,
  "aiCalls": false,
  "touchesPillars": false,
  "runtimePromptChanged": false,
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesExpected": 5,
  "filesOk": 5,
  "filesFailed": 0,
  "files": [
    {
      "path": "AGENTS.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 4238,
      "sha": "5f00142c29ac4d4f5354561499fa973b5773241b",
      "hash": "25443467",
      "required": true
    },
    {
      "path": "agent_workspace/START_HERE.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 1068,
      "sha": "29a4aecac37965931f6abeb5736cee74ee8d248f",
      "hash": "f4ece390",
      "required": true
    },
    {
      "path": "agent_workspace/ADVISOR_PROTOCOL.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 5010,
      "sha": "0ec5d3a3624dc8c90ec28bda3cce39a6815f2c0c",
      "hash": "73152852",
      "required": true
    },
    {
      "path": "agent_workspace/COMMANDS.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 1388,
      "sha": "7a2d7befde8dfa8ae2c7153875ef8f0716d8dffe",
      "hash": "65c05d66",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 220,
      "sha": "af7c937ae4a3a325399e1a4f2b6f1c548dfb7bc2",
      "hash": "13afed20",
      "required": true
    }
  ],
  "warnings": []
}
```
