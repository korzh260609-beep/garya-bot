# SAVEPOINT — Living SG Source Result Envelope Soft Wiring Merged

Saved at: `2026-05-02T06:20:00+03:00`
Saved by: `SG-advisor`
Scope: `Living SG sourceResultEnvelope soft wiring after PR #38 merge`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Merged PR: #38 — Soft wire Living SG source result envelope through chat flow
Merge commit: 5152b17be32ec3c9a36120e16f268d731ed2eae2
Previous merged PR: #37 — Add savepoint for PR #36 source result envelope adapter
Previous merge commit: 5fb3f13113845e204a25646cdb77152e43424c67
```

---

## Confirmed merged result

```text
sourceFlow.js now adapts already-existing sourceCtx.sourceResult into sourceResultEnvelope.
sourceFlow.js returns sourceResultEnvelope and sourceResultEnvelopeAdapterResult.
chatAiOrchestrationFlow.js passes sourceResultEnvelope into buildChatMessages.
```

---

## Active behavior contract

```text
This is Variant A / soft wiring.
Old sourceResultSystemMessage remains active.
sourceResultEnvelope is passed forward as explicit input.
promptAssembly still preserves manual sourceResultSystemMessage precedence.
Prompt behavior is not fully switched to envelope-generated evidence yet.
```

Manual precedence remains:

```text
manual/sourceResultSystemMessage
> generated from explicit sourceResultEnvelope/sourceResult
> nothing
```

---

## Files changed by PR #38

```text
.github/workflows/smoke-living-sg-source-result-envelope-soft-wiring.yml
package.json
scripts/smokeLivingSGSourceResultEnvelopeSoftWiring.js
src/bot/handlers/chat/chatAiOrchestrationFlow.js
src/bot/handlers/chat/sourceFlow.js
```

---

## Confirmed safety status after PR #38

```text
executor: not created
repo-read runtime: not connected
repo-write runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
new source execution: not added
runtime adapter wiring: added only for already-existing sourceCtx.sourceResult
deploy: not performed
```

---

## CI observed before merge

```text
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
Living SG sourceResultEnvelope is soft-wired through sourceFlow → chatAiOrchestrationFlow → buildChatMessages.
Old sourceResultSystemMessage path remains active and preserves prompt behavior.
```

---

## Next safe microstep

```text
Inspect promptAssembly precedence and sourceFlow output behavior after soft wiring.
Then prepare controlled switch plan for Variant B:
- when sourceResultEnvelope exists, allow promptAssembly to generate SOURCE RESULT SYSTEM EVIDENCE;
- preserve fallback to old sourceResultSystemMessage if envelope is missing/invalid;
- do not add source execution;
- do not add repo-read runtime;
- do not add executor;
- do not add slash commands;
- no deploy without explicit command.
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
Controlled switch to envelope evidence must be a separate microstep.
```
