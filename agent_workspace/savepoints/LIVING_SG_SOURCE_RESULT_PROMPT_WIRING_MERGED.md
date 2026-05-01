# SAVEPOINT — Living SG Source Result Prompt Wiring Merged

Saved at: `2026-05-01T22:10:00+03:00`
Saved by: `SG-advisor`
Scope: `Living SG sourceResultSystemMessage promptAssembly wiring after PR #34 merge`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Merged PR: #34 — Wire Living SG source result system message into prompt assembly
Merge commit: 468304bc16caf5fdb3207b8d4c20f0ded68e3e9d
Previous merged PR: #33 — Add Living SG source result system message builder skeleton
Previous merge commit: b291b3f8f4954057d22405565726cd94be743a95
```

---

## Confirmed merged result

```text
promptAssembly.js can now build sourceResultSystemMessage from an explicit sourceResultEnvelope/sourceResult.
Manually supplied sourceResultSystemMessage has precedence.
No source-result evidence is generated when no explicit sourceResultEnvelope/sourceResult is provided.
```

---

## Manual precedence contract

```text
manual sourceResultSystemMessage
> generated from explicit sourceResultEnvelope/sourceResult
> nothing
```

---

## Files changed by PR #34

```text
.github/workflows/smoke-prompt-source-result-system-message-wiring.yml
package.json
scripts/smokePromptAssemblySourceResultSystemMessageWiring.js
src/bot/handlers/chat/promptAssembly.js
```

---

## Confirmed safety status after PR #34

```text
executor: not created
repo-read runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
runtime source execution: not added
repository writes by SG runtime: not added
deploy: not performed
```

---

## CI observed before merge

```text
Smoke Prompt Source Result System Message Wiring: success
Smoke Living SG Repo Read Planner Envelope Contract: success
Smoke Living SG Source Proof Envelope Input: success
Smoke Prompt Source Result Envelope Guard: success
Smoke Living SG Source Result Envelope: success
Smoke Living SG Source Result System Message: success
SG Minimal CI: success
```

---

## Current completed microstep

```text
Living SG sourceResultSystemMessage builder is wired into promptAssembly input path only for explicit sourceResultEnvelope/sourceResult input.
```

---

## Next safe microstep

```text
Inspect current call sites of buildChatMessages and sourceResult inputs before any further wiring.
Determine where explicit sourceResultEnvelope/sourceResult could be passed in future, without connecting repo-read runtime or executor.
Read-only analysis first.
No code changes until existing call paths are inspected.
```

---

## Warnings

```text
Do not connect Human Meaning Provider yet.
Do not connect RepoStateAgent runtime yet.
Do not add executor.
Do not add repo-read runtime yet.
Do not expand Technical Mode.
Do not add slash commands.
Do not deploy unless explicitly requested by Monarch.
Do not treat planner metadata or expectedSourceResultEnvelope as proof.
Do not generate source evidence unless explicit sourceResultEnvelope/sourceResult is provided.
```
