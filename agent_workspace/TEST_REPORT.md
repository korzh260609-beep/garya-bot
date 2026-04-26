# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `memory-7-9-3-confirmed-restore`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-26T17:32:59.722Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/memory_confirmed_restore_diag
```

## Expected answers

The runner must execute allowlisted SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/memory_confirmed_restore_diag: OK
```

## Chat response logs

```text
## /memory_confirmed_restore_diag
🧪 MEMORY CONFIRMED RESTORE DIAG
validation: OK
chat_id: agent_workspace_capture
globalUserId: NULL
key: diag.memory_confirmed_restore.20260426173259.ulm07a
expectedType: general_fact
expectedDomain: user_memory
expectedSlot: generic

1) remember: ok=true stored=true reason=remember_saved guard=ALLOW_CANDIDATE check=true
2) emptySelector: ok=false reason=empty_restore_selector total=0 check=true
3) selected: ok=true total=3 hasKey=true reason=confirmed_restore_context_selected check=true
4) bounded: maxItems=5 maxChars=700 maxItemChars=180 check=true
5) safety: promptFacing=false raw=false digest=false archive=false forbiddenLayers=false check=true

checks: remember=true emptySelector=true selected=true bounded=true safety=true
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_OK`

## Notes

## /memory_confirmed_restore_diag
ok=true
handler=handleMemoryConfirmedRestoreDiag
error=-
```json
{
  "key": "diag.memory_confirmed_restore.20260426173259.ulm07a",
  "remember": {
    "ok": true,
    "stored": true,
    "reason": "remember_saved",
    "guardDecision": "ALLOW_CANDIDATE"
  },
  "emptySelector": {
    "ok": false,
    "total": 0,
    "reason": "empty_restore_selector"
  },
  "selected": {
    "ok": true,
    "total": 3,
    "reason": "confirmed_restore_context_selected",
    "warnings": []
  },
  "checks": {
    "remember": true,
    "emptySelector": true,
    "selected": true,
    "bounded": true,
    "safety": true
  }
}
```
