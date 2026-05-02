# SAVEPOINT — Living SG Technical Natural Bridge Blocked

Saved at: `2026-05-02T08:30:00+03:00`
Saved by: `SG-advisor`
Scope: `Savepoint after PR #44 merge`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Merged PR: #44 — Block legacy diagnostic natural bridge in Living SG path
Merge commit: a7c9daf54aa7a60c1313698d465439ff2b65b220
Previous merged PR: #43 — Add savepoint for PR #42 source result evidence path smoke
Previous merge commit: 511abfc33742993b84f7503ce94de3a248493893
```

---

## Confirmed merged result

```text
Legacy diagnostic natural bridge is now hard-blocked inside legacyProjectIntentFlow.
The bridge can no longer be re-enabled through allowDiagnosticNaturalBridge flags.
Normal user text must not be converted into a diagnostic technical handler path through this boundary.
```

---

## Files changed by PR #44

```text
src/core/handleMessage/legacyProjectIntentFlow.js
scripts/smokeLegacyProjectIntentFlowSkeleton.js
```

---

## Important behavior after PR #44

```text
isDiagnosticNaturalBridgeAllowed() always returns false.
createLegacyProjectIntentFlowInput() always sets allowDiagnosticNaturalBridge=false.
createLegacyProjectIntentFlowInput() marks diagnosticNaturalBridgeHardBlocked=true.
legacyProjectIntentFlow no longer imports maybeHandleProjectDiagnosticNaturalBridge.
```

---

## Current safe status after PR #44

```text
executor: not created
repo-read runtime: not connected
repo-write runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
new source execution: not added
deploy: not performed
```

---

## Current completed microstep

```text
Technical natural diagnostic bridge has been blocked from the normal Living SG path.
Legacy projectIntent remains isolated, but cannot route ordinary natural text into diagnostic technical handling through allowDiagnosticNaturalBridge.
```

---

## Next safe microstep

```text
Continue separating remaining legacy/projectIntent behavior from Living SG path.
Recommended next read-only inspection:
- review projectIntent route usage still active inside legacyProjectIntentFlow;
- identify which projectIntent read-only behaviors should stay as legacy compatibility;
- identify which behaviors should move later into Living SG capability/source planning;
- do not connect repo-read runtime yet;
- do not add executor;
- do not add slash commands;
- do not deploy.
```

---

## Warnings

```text
Do not treat this savepoint as runtime proof beyond PR #44 merge.
Do not expand Technical Mode.
Do not reconnect diagnostic natural bridge under another name.
Do not build keyword/phrase routing as Living SG intelligence.
Do not treat projectIntent legacy route as final Living SG capability planning.
Any next runtime change must remain skeleton → config → logic and must go through branch + PR.
```
