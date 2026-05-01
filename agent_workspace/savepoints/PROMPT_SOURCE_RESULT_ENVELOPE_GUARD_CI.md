# SAVEPOINT — Prompt Source Result Envelope Guard CI

Saved at: `2026-05-01T19:15:00Z`
Saved by: `SG-advisor`
Scope: `promptAssembly sourceResult envelope evidence policy + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Work branch: sg-prompt-envelope-guard-01
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Add prompt-level sourceResult envelope evidence guard.
```

---

## Confirmed principle

```text
sourceResult envelope may support verified claims only when explicit source-result system evidence is present and confirmed.
missing/invalid/stale/unconfirmed envelope must force source-honest wording.
expectedSourceResultEnvelope is not proof.
envelope metadata and planner metadata cannot authorize writes.
confirmed read envelope never authorizes write actions.
```

---

## Important commits in this block

```text
9122f070e94f6a639933238259f2dba738844cc1
- Updated src/bot/handlers/chat/promptAssembly.js.
- Added SOURCE RESULT ENVELOPE EVIDENCE POLICY.
- Added promptBlockSourceResultEnvelopeEvidencePolicyChars diagnostics.
- Inserted policy before sourceResultSystemMessage.

2e1c63e27e197dcf41943ac59934d99382f4ee91
- Added scripts/smokePromptAssemblySourceResultEnvelopeGuard.js.
- Smoke verifies policy content, diagnostics and ordering.

ff76b40caf2515326087a3ce9953815e6c515fb1
- Added npm script smoke:prompt-source-result-envelope-guard.

df25cca6e218c9047346eac84dcdff5474215a6c
- Added GitHub Actions workflow Smoke Prompt Source Result Envelope Guard.
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
```

---

## Current completed microstep

```text
promptAssembly now adds a sourceResult envelope evidence policy before sourceResultSystemMessage.
```

---

## Expected check

```bash
npm run smoke:prompt-source-result-envelope-guard
```

Expected result:

```text
Smoke Prompt Assembly Source Result Envelope Guard — OK
```

---

## Next safe microstep after merge

```text
Prepare the future sourceResultSystemMessage builder skeleton:
- builder converts sourceResult envelope into prompt-safe system evidence;
- builder does not execute sources;
- builder does not read repo runtime;
- builder does not authorize writes;
- no runtime wiring yet.
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