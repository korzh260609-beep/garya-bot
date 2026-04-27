# TEST_REPORT

SG diagnostic command results after workspace command execution.

---

Task ID: `repo-state-scan-runtime-check`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T13:13:44.500Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test commands

```text
/repo_state_scan
```

## Expected answers

The runner must execute read-only SG diagnostic chat commands and capture the same text SG would send to chat.

## Actual answers

```text
/repo_state_scan: FAILED
```

## Chat response logs

```text
## /repo_state_scan
-
```

## Render logs during test

```text
Use RENDER_REPORT.md for RenderBridge logs collected by verify actions.
```

## Result

- `DIAGNOSTICS_FAILED`

## Notes

## /repo_state_scan
ok=false
handler=-
error=diagnostic_command_not_allowed_or_not_read_only
```json
{}
```
