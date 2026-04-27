# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `agentworkspace-bootstrap-reader`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T05:16:00.000Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/agent_bootstrap_diag
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/agent_bootstrap_diag: OK
```

## Chat response logs

```text
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
OK: agent_workspace/COMMANDS.md chars=1301 hash=871819c8
OK: agent_workspace/TEST_REPORT.md chars=192 hash=02dc77fc

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
      "chars": 1301,
      "sha": "d1dbe57fb40a218b66324d22b40ec91d57ede497",
      "hash": "871819c8",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 192,
      "sha": "5aae1bc00a1fef83f47d83c3d59e956d694a1ee5",
      "hash": "02dc77fc",
      "required": true
    }
  ],
  "warnings": []
}
```
