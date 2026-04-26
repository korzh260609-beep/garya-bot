# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `memory-7-9-2-long-term-read`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-26T17:12:02.931Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/memory_long_term_read_diag
```

## Expected answers

The runner must execute allowlisted SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/memory_long_term_read_diag: OK
```

## Chat response logs

```text
## /memory_long_term_read_diag
🧪 MEMORY LONG-TERM READ DIAG
validation: OK
chat_id: agent_workspace_capture
globalUserId: NULL
key: diag.memory_long_term_read.20260426171202.cffb7x
expectedType: general_fact
expectedDomain: user_memory
expectedSlot: generic

1) remember: ok=true stored=true reason=remember_saved guard=ALLOW_CANDIDATE check=true
2) byKey: ok=true total=1 hasKey=true check=true reason=-
3) byType: ok=true total=2 hasKey=true check=true reason=-
4) byDomain: ok=true total=2 hasKey=true check=true reason=-
5) bySlot: ok=true total=2 hasKey=true check=true reason=-
6) byDomainSlot: ok=true total=2 hasKey=true check=true reason=-
7) summary: ok=true hasDomain=true hasDomainSlot=true check=true reason=-
8) selectLongTermContext: ok=true total=2 hasKey=true check=true reason=-

checks: remember=true byKey=true byType=true byDomain=true bySlot=true byDomainSlot=true summary=true selected=true
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_OK`

## Notes

## /memory_long_term_read_diag
ok=true
handler=handleMemoryLongTermReadDiag
error=-
```json
{
  "key": "diag.memory_long_term_read.20260426171202.cffb7x",
  "remember": {
    "ok": true,
    "stored": true,
    "reason": "remember_saved",
    "guardDecision": "ALLOW_CANDIDATE"
  },
  "byKey": {
    "ok": true,
    "total": 1,
    "reason": null
  },
  "byType": {
    "ok": true,
    "total": 2,
    "reason": null
  },
  "byDomain": {
    "ok": true,
    "total": 2,
    "reason": null
  },
  "bySlot": {
    "ok": true,
    "total": 2,
    "reason": null
  },
  "byDomainSlot": {
    "ok": true,
    "total": 2,
    "reason": null
  },
  "summary": {
    "ok": true,
    "reason": null
  },
  "selected": {
    "ok": true,
    "total": 2,
    "reason": null
  }
}
```
