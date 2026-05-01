# SAVEPOINT — Living SG Source Result System Message Builder CI

Saved at: `2026-05-01T19:30:00Z`
Saved by: `SG-advisor`
Scope: `Living SG sourceResultSystemMessage builder skeleton + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Work branch: sg-sr-msg-builder-01
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Prepare future sourceResultSystemMessage builder skeleton.
```

---

## Confirmed principle

```text
Builder converts an already-provided sourceResult envelope into prompt-safe system evidence.
Builder does not execute sources.
Builder does not read repository runtime.
Builder does not authorize writes.
Builder does not wire into promptAssembly yet.
Missing envelope produces source-honest not-verified system evidence.
Confirmed envelope may support verified claims only for the stated target.
```

---

## Important commits in this block

```text
649147d36658e19abd4acf118d063c6c0d3843fd
- Added src/core/living-sg/LivingSourceResultSystemMessage.js.
- Converts sourceResultEnvelope/sourceResult into system evidence.
- Handles missing envelope as not verified.
- Keeps write authorization false.

3b13d5a75458d958e3150b0f60949d458fd6bdd8
- Added scripts/smokeLivingSGSourceResultSystemMessage.js.
- Smoke verifies confirmed/missing/stale evidence and safety wording.

9fa6fb6088a08d2e2fdade79290c85b0a5e51208
- Added npm script smoke:living-sg-source-result-system-message.

90ee8e37dc94db9278171db9c7f593e2961452ef
- Added GitHub Actions workflow Smoke Living SG Source Result System Message.
```

---

## Safe status

```text
executor: not created
repo-read runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
runtime: not changed
deploy: not performed
promptAssembly wiring: not changed
```

---

## Current completed microstep

```text
Living SG sourceResultSystemMessage builder skeleton is prepared in branch sg-sr-msg-builder-01.
```

---

## Expected check

```bash
npm run smoke:living-sg-source-result-system-message
```

Expected result:

```text
Smoke Living SG Source Result System Message — OK
```

---

## Next safe microstep after merge

```text
Wire sourceResultSystemMessage builder into prompt assembly input path only if an explicit envelope is already provided:
- no source execution;
- no repo-read runtime;
- no executor;
- no writes;
- preserve existing manually supplied sourceResultSystemMessage precedence.
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
```