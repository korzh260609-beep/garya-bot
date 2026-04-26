# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `memory-7-9-6-monarch-memory-diagnostics`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-26T18:33:57.122Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/memory_monarch_diag
```

## Expected answers

The runner must execute allowlisted SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/memory_monarch_diag: FAILED
```

## Chat response logs

```text
## /memory_monarch_diag
🧠 MEMORY MONARCH DIAG
validation: FAILED
chat_id: agent_workspace_capture
globalUserId: NULL

1) core:
enabled: true ✅
mode: PROJECT_MEMORY
backend: chat_memory
contractVersion: 1
hasDb: true ✅
hasChatAdapter: true ✅
hasLongTermRead: true ✅
hasWriteService: true ✅
hasArchiveService: true ✅
hasTopicDigestService: true ✅
hasRawPromptGuard: true ✅
hasConfirmedGuard: true ✅
check: true ✅

2) DB columns:
global_user_id: true ✅
transport: true ✅
metadata: true ✅
schema_version: true ✅
check: true ✅

3) archive layer:
storageActive: true ✅
restoreCapable: true ✅
promptFacing: false ⛔
rawPromptInjectionAllowed: false ⛔
reason: raw_archive_bounded_write_active_not_prompt_facing
check: true ✅

4) topic digest layer:
storageActive: false ⛔
aiGenerationActive: false ⛔
restoreCapable: true ✅
promptFacing: false ⛔
rawPromptInjectionAllowed: false ⛔
reason: topic_digest_skeleton_active_no_storage
check: true ✅

5) recall / guards:
topicRecallPromptFacing: false ⛔
topicRecallRawPromptInjectionAllowed: false ⛔
rawPromptGuard: true ✅
confirmedGuard: true ✅
check: false ⛔

6) diagnostics / buffer:
diagnosticsService: true ✅
safetyDiagnostics: false ⛔
bufferEnabled: true
bufferQueueSize: 0

checks: core=true db=true archive=true digest=true recall=false guards=true diagnostics=false
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_FAILED`

## Notes

## /memory_monarch_diag
ok=false
handler=dispatchMemoryDiagnosticsCommands
error=-
```json
{
  "handled": true,
  "validationOk": false,
  "checksLine": "checks: core=true db=true archive=true digest=true recall=false guards=true diagnostics=false"
}
```
