# SAVEPOINT — Living SG Source Result Envelope Controlled Switch Merged

Saved at: `2026-05-02T06:35:00+03:00`
Saved by: `SG-advisor`
Scope: `Living SG sourceResultEnvelope controlled switch after PR #40 merge`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Merged PR: #40 — Switch source evidence to envelope when available
Merge commit: 7e2343816ae458ff72757979d2031ac85cbfa781
Previous merged PR: #39 — Add savepoint for PR #38 source result envelope soft wiring
Previous merge commit: 4bff53bd3467df515739297f74a759e1fb61cc84
```

---

## Confirmed merged result

```text
sourceFlow.js now uses controlled switch behavior for source evidence.
If valid sourceResultEnvelope exists, sourceResultSystemMessage is set to null.
This allows promptAssembly.js to generate SOURCE RESULT SYSTEM EVIDENCE from the explicit envelope.
If sourceResultEnvelope is missing, legacy sourceResultSystemMessage remains available as fallback.
```

---

## Active evidence contract

```text
valid sourceResultEnvelope exists
→ sourceResultSystemMessage = null
→ promptAssembly generates SOURCE RESULT SYSTEM EVIDENCE from envelope
```

Fallback contract:

```text
sourceResultEnvelope missing
→ sourceResultSystemMessage = legacySourceResultSystemMessage
```

---

## Files changed by PR #40

```text
.github/workflows/smoke-living-sg-source-result-envelope-controlled-switch.yml
package.json
scripts/smokeLivingSGSourceResultEnvelopeControlledSwitch.js
scripts/smokeLivingSGSourceResultEnvelopeSoftWiring.js
src/bot/handlers/chat/sourceFlow.js
```

---

## Confirmed safety status after PR #40

```text
executor: not created
repo-read runtime: not connected
repo-write runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
new source execution: not added
source evidence controlled switch: added
deploy: not performed
```

---

## CI observed before merge

```text
Smoke Living SG Source Result Envelope Controlled Switch: success
Smoke Living SG Source Result Envelope Soft Wiring: success
Smoke Living SG Source Result Envelope Adapter: success
Smoke Living SG Source Result Envelope: success
Smoke Living SG Source Result System Message: success
Smoke Prompt Source Result System Message Wiring: success
Smoke Living SG Source Proof Envelope Input: success
Smoke Living SG Repo Read Planner Envelope Contract: success
Smoke Prompt Source Result Envelope Guard: success
SG Minimal CI: success
```

---

## Current completed microstep

```text
Living SG source evidence now switches to sourceResultEnvelope when available.
Legacy SOURCE RESULT system message remains fallback only when envelope is missing.
```

---

## Next safe microstep

```text
Read-only inspection of current source evidence flow after controlled switch:
- sourceFlow.js
- promptAssembly.js
- chatAiOrchestrationFlow.js
- relevant smoke tests

Goal:
confirm final runtime path:
existing sourceCtx.sourceResult
→ adapter
→ sourceResultEnvelope
→ buildChatMessages
→ SOURCE RESULT SYSTEM EVIDENCE

No code changes until inspection is complete.
No deploy without explicit command.
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
Do not treat sourceResultEnvelope as write permission.
Do not treat planner metadata or expectedSourceResultEnvelope as proof.
Any real repo-read runtime must be a separate skeleton → config → logic sequence.
```
