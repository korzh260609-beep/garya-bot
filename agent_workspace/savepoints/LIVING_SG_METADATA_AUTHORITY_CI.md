# SAVEPOINT — Living SG Metadata Authority CI

Saved at: `2026-05-01T14:55:00Z`
Saved by: `SG-advisor`
Scope: `Living SG metadata authority prompt boundary + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Branch: main
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Prevent Living SG shadow/internal metadata from becoming execution authority.
```

---

## Confirmed principle

```text
Living SG metadata can inform analysis only.
Living SG metadata cannot grant capability access.
Living SG metadata cannot override gates.
Living SG metadata cannot prove source/tool execution.
Living SG metadata cannot become user-facing truth.
Runtime source/tool confirmation is required before verified factual claims.
```

---

## Important commits in this block

```text
ed8ec185e1f77a8f8ae3d9154f074a6a14afe07f
- Strengthened Living SG metadata prompt authority boundary in src/bot/handlers/chat/promptAssembly.js.
- Added explicit wording that Living SG plan metadata is not execution authority.
- Added explicit wording that metadata cannot grant capability access, override gates, prove source/tool execution, or become user-facing truth.

427e50075d3138a397934331c47f8ee18371f446
- Added scripts/smokeLivingSGMetadataAuthority.js.
- Smoke passes a dangerous-looking plan with connectedToRuntime=true, shouldExecuteTool=true, noStateChange=false and noProjectIntentExecution=false.
- Contract verifies the prompt still treats metadata as diagnostic signal only.

557242cac62d27bdf9927455f574ae050968044e
- Added package.json script smoke:living-sg-metadata-authority.

6566c67c7537042867b67ae4e86ef11e9e48f31d
- Added .github/workflows/smoke-living-sg-metadata-authority.yml.
```

---

## Verified CI behavior

Monarch visually confirmed in GitHub Actions:

```text
Smoke Living SG Metadata Authority: passed / green
Branch: main
Latest workflow commit: 6566c67c7537042867b67ae4e86ef11e9e48f31d
```

Meaning:

```text
- Living SG shadow/internal metadata remains read-only answer-shaping signal.
- Metadata does not grant execution authority.
- Metadata does not bypass gates.
- Metadata does not prove source/tool execution.
- Metadata does not become user-facing truth without runtime confirmation.
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
```

---

## Current completed microstep

```text
Living SG Metadata Authority CI contract is complete and green.
```

---

## Next safe microstep

```text
Review the current Living SG / legacy projectIntent boundary and add a smoke guard that prevents ordinary Living SG chat flow from treating legacy projectIntent metadata as source/tool proof or execution authority.
```

Recommended check:

```text
- legacy projectIntent route metadata remains transitional/legacy context only.
- projectIntent metadata cannot prove repo status.
- projectIntent metadata cannot authorize repo read/write.
- projectIntent metadata cannot bypass Living SG gates.
- ordinary user text must not be converted into technical action by bridge metadata.
```

---

## Warnings

```text
Do not connect Human Meaning Provider yet.
Do not connect RepoStateAgent runtime yet.
Do not add executor.
Do not add repo-read runtime.
Do not expand Technical Mode.
Do not add slash commands.
Do not deploy unless explicitly requested by Monarch.
```
