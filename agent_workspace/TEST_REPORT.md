# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `project-memory-7a-shadow-restore-diagnostic`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T03:02:08.455Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/pm_shadow_context_diag
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/pm_shadow_context_diag: OK
```

## Chat response logs

```text
## /pm_shadow_context_diag
🧠 Project Memory shadow context diag

build: pm-shadow-context-diag-2026-04-27-01
command: /pm_shadow_context_diag
stage: 7A.9

readOnly: yes
dbWrites: no
aiCalls: no
shadowMode: yes
runtimePromptChanged: no

buildProjectMemoryContext: OK
buildProjectMemoryDigest: OK
listConfirmedProjectMemoryEntries: OK

contextOk: yes
digestOk: yes
confirmedReaderOk: yes
contextChars: 968
totalEntries: 19
aiContextEligibleTotal: 5
sectionsTotal: 12
entryTypesTotal: 3

workflowPositionFound: yes
activeDecisionsTotal: 4
activeConstraintsTotal: 0
openRisksFound: yes
openRisksTotal: 2
nextSafeStepsTotal: 0

confirmedMemoryUsed: yes
chatContextUsed: no
confirmedVsChatSeparated: yes

warnings: active_constraints_not_found_in_confirmed_memory, next_safe_step_not_found_in_confirmed_memory

Result: OK
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_OK`

## Notes

## /pm_shadow_context_diag
ok=true
handler=handlePmShadowContextDiag
error=-
```json
{
  "validationOk": true,
  "diag": {
    "command": "/pm_shadow_context_diag",
    "build": "pm-shadow-context-diag-2026-04-27-01",
    "stage": "7A.9",
    "readOnly": true,
    "dbWrites": false,
    "aiCalls": false,
    "shadowMode": true,
    "runtimePromptChanged": false,
    "chatContextUsed": false,
    "confirmedMemoryUsed": true,
    "hasContextBuilder": true,
    "hasDigestBuilder": true,
    "hasConfirmedReader": true,
    "contextOk": true,
    "digestOk": true,
    "confirmedReaderOk": true,
    "contextChars": 968,
    "totalEntries": 19,
    "aiContextEligibleTotal": 5,
    "sectionsTotal": 12,
    "entryTypesTotal": 3,
    "workflowPositionFound": true,
    "activeDecisionsTotal": 4,
    "activeConstraintsTotal": 0,
    "openRisksFound": true,
    "openRisksTotal": 2,
    "nextSafeStepsTotal": 0,
    "confirmedVsChatSeparated": true,
    "warnings": [
      "active_constraints_not_found_in_confirmed_memory",
      "next_safe_step_not_found_in_confirmed_memory"
    ],
    "error": null
  }
}
```
