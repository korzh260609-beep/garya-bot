# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `agentworkspace-auto-chaos-suite`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T06:19:08.129Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/agent_bootstrap_diag
/agent_bootstrap_strict_diag
/agent_bootstrap_chaos_pillars_diag
/agent_bootstrap_chaos_github_diag
/agent_bootstrap_chaos_missing_diag
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/agent_bootstrap_diag: OK
/agent_bootstrap_strict_diag: OK
/agent_bootstrap_chaos_pillars_diag: OK
/agent_bootstrap_chaos_github_diag: OK
/agent_bootstrap_chaos_missing_diag: OK
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
OK: agent_workspace/COMMANDS.md chars=1437 hash=9e955505
OK: agent_workspace/TEST_REPORT.md chars=192 hash=688696a0

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
OK: agent_workspace/COMMANDS.md chars=1437 hash=9e955505
OK: agent_workspace/TEST_REPORT.md chars=192 hash=688696a0

Strict checks:
readOnly: yes
noDbWrites: yes
noAiCalls: yes
noPillarsTouch: yes
noRuntimePromptChange: yes
allBootstrapFilesReadable: yes

warnings: -

Result: OK

## /agent_bootstrap_chaos_pillars_diag
🧪 AgentWorkspace bootstrap chaos diag

scenario: pillars_fail
controlledSimulation: yes

realReadOnly: yes
realDbWrites: no
realAiCalls: no
realTouchesPillars: no
realRuntimePromptChanged: no
realFilesChanged: no

simulatedFailure: pillars_touch_attempt_detected
simulatedResult: FAILED
simulatedTouchesPillars: yes
simulatedGithubApiAvailable: -
simulatedMissingFile: -

filesExpected: 5
filesOk: 5
filesFailed: 0

Expected gate behavior:
diagnostic bootstrap safety gate must block execution

warnings: chaos_simulated_pillars_touch_attempt

Result: OK

## /agent_bootstrap_chaos_github_diag
🧪 AgentWorkspace bootstrap chaos diag

scenario: github_fail
controlledSimulation: yes

realReadOnly: yes
realDbWrites: no
realAiCalls: no
realTouchesPillars: no
realRuntimePromptChanged: no
realFilesChanged: no

simulatedFailure: github_api_unavailable
simulatedResult: FAILED
simulatedTouchesPillars: no
simulatedGithubApiAvailable: no
simulatedMissingFile: -

filesExpected: 5
filesOk: 0
filesFailed: 5

Expected gate behavior:
diagnostic bootstrap safety gate must block execution

warnings: chaos_simulated_github_api_unavailable

Result: OK

## /agent_bootstrap_chaos_missing_diag
🧪 AgentWorkspace bootstrap chaos diag

scenario: missing_file
controlledSimulation: yes

realReadOnly: yes
realDbWrites: no
realAiCalls: no
realTouchesPillars: no
realRuntimePromptChanged: no
realFilesChanged: no

simulatedFailure: required_bootstrap_file_missing
simulatedResult: FAILED
simulatedTouchesPillars: no
simulatedGithubApiAvailable: -
simulatedMissingFile: AGENTS.md

filesExpected: 5
filesOk: 4
filesFailed: 1

Expected gate behavior:
diagnostic bootstrap safety gate must block execution

warnings: chaos_simulated_required_bootstrap_file_missing

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
      "chars": 1437,
      "sha": "13bae96e2a46c03883ee922a2b696ce5d864808d",
      "hash": "9e955505",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 192,
      "sha": "96e57a0c8ebddace42f41acbdf88cfeb05eac57e",
      "hash": "688696a0",
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
      "chars": 1437,
      "sha": "13bae96e2a46c03883ee922a2b696ce5d864808d",
      "hash": "9e955505",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 192,
      "sha": "96e57a0c8ebddace42f41acbdf88cfeb05eac57e",
      "hash": "688696a0",
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

## /agent_bootstrap_chaos_pillars_diag
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
      "chars": 1437,
      "sha": "13bae96e2a46c03883ee922a2b696ce5d864808d",
      "hash": "9e955505",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 192,
      "sha": "96e57a0c8ebddace42f41acbdf88cfeb05eac57e",
      "hash": "688696a0",
      "required": true
    }
  ],
  "warnings": [
    "chaos_simulated_pillars_touch_attempt"
  ],
  "chaosMode": true,
  "controlledSimulation": true,
  "realReadOnly": true,
  "realDbWrites": false,
  "realAiCalls": false,
  "realTouchesPillars": false,
  "realRuntimePromptChanged": false,
  "realFilesChanged": false,
  "scenario": "pillars_fail",
  "simulatedResult": "FAILED",
  "expectedGateBehavior": "diagnostic bootstrap safety gate must block execution",
  "simulatedTouchesPillars": true,
  "simulatedFailure": "pillars_touch_attempt_detected"
}
```

## /agent_bootstrap_chaos_github_diag
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
  "filesOk": 0,
  "filesFailed": 5,
  "files": [
    {
      "path": "AGENTS.md",
      "ok": false,
      "status": 503,
      "error": "chaos_simulated_github_api_unavailable",
      "chars": 0,
      "sha": null,
      "hash": null,
      "required": true
    },
    {
      "path": "agent_workspace/START_HERE.md",
      "ok": false,
      "status": 503,
      "error": "chaos_simulated_github_api_unavailable",
      "chars": 0,
      "sha": null,
      "hash": null,
      "required": true
    },
    {
      "path": "agent_workspace/ADVISOR_PROTOCOL.md",
      "ok": false,
      "status": 503,
      "error": "chaos_simulated_github_api_unavailable",
      "chars": 0,
      "sha": null,
      "hash": null,
      "required": true
    },
    {
      "path": "agent_workspace/COMMANDS.md",
      "ok": false,
      "status": 503,
      "error": "chaos_simulated_github_api_unavailable",
      "chars": 0,
      "sha": null,
      "hash": null,
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": false,
      "status": 503,
      "error": "chaos_simulated_github_api_unavailable",
      "chars": 0,
      "sha": null,
      "hash": null,
      "required": true
    }
  ],
  "warnings": [
    "chaos_simulated_github_api_unavailable"
  ],
  "chaosMode": true,
  "controlledSimulation": true,
  "realReadOnly": true,
  "realDbWrites": false,
  "realAiCalls": false,
  "realTouchesPillars": false,
  "realRuntimePromptChanged": false,
  "realFilesChanged": false,
  "scenario": "github_fail",
  "simulatedResult": "FAILED",
  "expectedGateBehavior": "diagnostic bootstrap safety gate must block execution",
  "simulatedGithubApiAvailable": false,
  "simulatedFailure": "github_api_unavailable"
}
```

## /agent_bootstrap_chaos_missing_diag
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
  "filesOk": 4,
  "filesFailed": 1,
  "files": [
    {
      "path": "AGENTS.md",
      "ok": false,
      "status": 404,
      "error": "chaos_simulated_required_bootstrap_file_missing",
      "chars": 0,
      "sha": null,
      "hash": null,
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
      "chars": 1437,
      "sha": "13bae96e2a46c03883ee922a2b696ce5d864808d",
      "hash": "9e955505",
      "required": true
    },
    {
      "path": "agent_workspace/TEST_REPORT.md",
      "ok": true,
      "status": 200,
      "error": null,
      "chars": 192,
      "sha": "96e57a0c8ebddace42f41acbdf88cfeb05eac57e",
      "hash": "688696a0",
      "required": true
    }
  ],
  "warnings": [
    "chaos_simulated_required_bootstrap_file_missing"
  ],
  "chaosMode": true,
  "controlledSimulation": true,
  "realReadOnly": true,
  "realDbWrites": false,
  "realAiCalls": false,
  "realTouchesPillars": false,
  "realRuntimePromptChanged": false,
  "realFilesChanged": false,
  "scenario": "missing_file",
  "simulatedResult": "FAILED",
  "expectedGateBehavior": "diagnostic bootstrap safety gate must block execution",
  "simulatedMissingFile": "AGENTS.md",
  "simulatedFailure": "required_bootstrap_file_missing"
}
```
