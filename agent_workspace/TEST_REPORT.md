# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `agentworkspace-bootstrap-safety-check`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T06:07:37.018Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/agent_bootstrap_diag
/agent_bootstrap_strict_diag
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/agent_bootstrap_diag: OK
/agent_bootstrap_strict_diag: OK
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
OK: agent_workspace/COMMANDS.md chars=1357 hash=c9dac8a3
OK: agent_workspace/TEST_REPORT.md chars=198 hash=f58a9701

warnings: -

Result: OK

## /agent_bootstrap_strict_diag
🧭 AgentWorkspace bootstrap strict diag

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
OK: agent_workspace/COMMANDS.md chars=1357 hash=c9dac8a3
OK: agent_workspace/TEST_REPORT.md chars=198 hash=f58a9701

Strict checks:
readOnly: yes
noDbWrites: yes
noAiCalls: yes
noPillarsTouch: yes
noRuntimePromptChange: yes
allBootstrapFilesReadable: yes

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
      "chars": 1357,
      "sha": "5de0c286ad3931c63f69d84546d1c1608e361a55",
      "hash": "c9dac8a3",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 198,
      "sha": "d3208158b7cd9a00d629da6dd947d9931bc477d9",
      "hash": "f58a9701",
      "required": true
    }
  ],
  "warnings": []
}
```

## /agent_bootstrap_strict_diag
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
      "chars": 1357,
      "sha": "5de0c286ad3931c63f69d84546d1c1608e361a55",
      "hash": "c9dac8a3",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 198,
      "sha": "d3208158b7cd9a00d629da6dd947d9931bc477d9",
      "hash": "f58a9701",
      "required": true
    }
  ],
  "warnings": [],
  "strictChecks": {
    "readOnly": true,
    "noDbWrites": true,
    "noAiCalls": true,
    "noPillarsTouch": true,
    "noRuntimePromptChange": true,
    "allBootstrapFilesReadable": true
  }
}
```
