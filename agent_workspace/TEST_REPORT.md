# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `project-memory-7a-shadow-fill-diagnostic`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T03:16:15.108Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/pm_shadow_fill_diag
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/pm_shadow_fill_diag: OK
```

## Chat response logs

```text
## /pm_shadow_fill_diag
🧠 Project Memory shadow restore controlled diag

build: pm-shadow-restore-controlled-diag-2026-04-27-01
command: /pm_shadow_restore_controlled_diag
stage: 7A.10/7A.9

controlledWrite: yes
trustedPath: yes
dbWrites: yes
touchesPillars: no
touchesRawChatMemory: no
aiCalls: no
runtimePromptChanged: no

writeConfirmedProjectMemory: OK
listConfirmedProjectMemoryEntries: OK
buildProjectMemoryContext: OK
buildProjectMemoryDigest: OK

constraintWriteOk: yes
nextStepWriteOk: yes
readBackOk: yes
contextOk: yes
digestOk: yes

activeConstraintsTotal: 1
nextSafeStepsTotal: 1
diagConstraintsTotal: 1
diagNextStepsTotal: 1
constraintVisible: yes
nextStepVisible: yes
constraintInContext: yes
nextStepInContext: yes
contextChars: 1525
totalEntries: 21

Result: OK
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_OK`

## Notes

## /pm_shadow_fill_diag
ok=true
handler=handlePmShadowRestoreControlledDiag
error=-
```json
{
  "validationOk": true,
  "diag": {
    "command": "/pm_shadow_restore_controlled_diag",
    "build": "pm-shadow-restore-controlled-diag-2026-04-27-01",
    "stage": "7A.10/7A.9",
    "controlledWrite": true,
    "trustedPath": true,
    "dbWrites": true,
    "touchesPillars": false,
    "touchesRawChatMemory": false,
    "aiCalls": false,
    "runtimePromptChanged": false,
    "sourceRef": "diag:project-memory-7a-shadow-restore-controlled",
    "hasWriter": true,
    "hasReader": true,
    "hasContextBuilder": true,
    "hasDigestBuilder": true,
    "constraintWriteOk": true,
    "nextStepWriteOk": true,
    "readBackOk": true,
    "contextOk": true,
    "digestOk": true,
    "constraintVisible": true,
    "nextStepVisible": true,
    "constraintInContext": true,
    "nextStepInContext": true,
    "totalEntries": 21,
    "activeConstraintsTotal": 1,
    "nextSafeStepsTotal": 1,
    "diagConstraintsTotal": 1,
    "diagNextStepsTotal": 1,
    "contextChars": 1525,
    "error": null
  }
}
```
