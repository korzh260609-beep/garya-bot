# LIVING SG PROJECT INTENT REMAINING LEGACY AUDIT

Date: `2026-05-02`
Status: `AUDIT / NO RUNTIME CHANGES`
Owner: `Monarch Gary`
Base: `main @ 4f16a0d84ebae4b271e96cbae1d0e7646dd97dc5`

---

## 0. Purpose

This audit records what still remains from the old `projectIntent` / repo conversation path after the Living SG isolation work.

This file is documentation only.

It does not:

```text
change runtime
connect repo-read runtime
connect RepoStateAgent runtime
create executor
add slash commands
expand Technical Mode
deploy
```

---

## 1. Current confirmed state

After PR #44 and PR #45:

```text
legacy diagnostic natural bridge: hard-blocked
legacyProjectIntentFlow: isolated boundary
Technical natural bridge through allowDiagnosticNaturalBridge: blocked
savepoint: merged
```

Important current status:

```text
executor: not created
repo-read runtime: not connected
repo-write runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
deploy: not performed
```

---

## 2. Remaining legacy path

The remaining path is:

```text
normal chat flow
-> legacyProjectIntentFlow boundary
-> resolveProjectIntentRoute
-> requireProjectIntentAccess
-> runProjectIntentConversationFlow
-> legacy technical repo conversation
-> legacy snapshot / repo store
```

This is transitional compatibility, not final Living SG.

---

## 3. Files currently involved

### 3.1 Boundary still called from normal chat path

```text
src/core/handleMessage/legacyProjectIntentFlow.js
```

Remaining responsibilities:

```text
- loads repo follow-up context
- loads pending choice context
- builds projectIntentRoutingText
- runs ProjectContextEngine classification
- runs ProjectMemoryAutoCapture dry-run
- resolves legacy projectIntent route
- applies projectIntent access guard
- continues legacy repo conversation
- writes read-only repo_context markers when legacy repo conversation handles a request
```

Risk:

```text
This file is isolated, but still allows normal chat to pass into legacy projectIntent compatibility.
It must not grow.
```

---

### 3.2 Technical route facade

```text
src/core/projectIntent/projectIntentRoute.js
src/core/projectIntent/modes/technical/projectIntentTechnicalRoute.js
src/core/projectIntent/modes/technical/projectIntentTechnicalScope.js
```

Current role:

```text
Technical Mode compatibility route.
Uses deterministic phrase/token/path signals through technical scope classifier.
```

Allowed short-term:

```text
Keep for compatibility only.
Do not add new phrase-bound behavior.
Do not present this as Living SG intelligence.
```

Future replacement:

```text
Living SG meaning -> intent -> capability -> permission/gate -> source request.
```

---

### 3.3 Legacy access guard

```text
src/core/projectIntent/projectIntentGuard.js
```

Current role:

```text
Blocks or gates legacy projectIntent access.
Protects SG core internal write attempts.
```

Allowed short-term:

```text
Keep until Living SG capability gate replaces this path.
```

Risk:

```text
It still depends on legacy routeKey/policy.
It should not become the final Living SG permission system.
```

Future replacement:

```text
LivingActionGate / capability policy / source scope / confirmation policy.
```

---

### 3.4 Legacy repo conversation service

```text
src/core/projectIntent/projectIntentConversationService.js
```

Current role:

```text
Orchestrates legacy repo conversation:
- repo_status
- show_tree
- browse_folder
- find_target
- find_and_explain
- open_target
- explain_target
- explain_active
- continue_active
- answer_pending_choice
```

Risk:

```text
This is the biggest remaining compatibility bridge.
It can answer repo questions before the future Living SG source-result envelope path owns repo facts.
```

Allowed short-term:

```text
Keep as legacy compatibility.
Do not add new repo capabilities here.
Do not add new phrase/regex fallback hacks.
Do not treat it as Human Mode.
```

Future replacement:

```text
Living repo capabilities backed by sourceResultEnvelope proof.
```

---

### 3.5 Semantic resolver and fallback

```text
src/core/projectIntent/projectIntentSemanticResolver.js
src/core/projectIntent/semantic/projectIntentSemanticFallback.js
```

Current role:

```text
AI structured resolver where callAI exists.
Heuristic fallback where AI call is unavailable or fails.
```

Risk:

```text
Fallback remains heuristic/phrase based.
It is explicitly legacy Technical Mode support, not full Human Mode.
```

Allowed short-term:

```text
Keep for compatibility.
Do not expand fallback with new phrase hacks.
```

Future replacement:

```text
Human Meaning Provider / structured Living SG meaning contract, only after explicit gate.
```

---

### 3.6 Legacy repo bootstrap and repo store

```text
src/core/projectIntent/conversation/projectIntentConversationBootstrap.js
src/core/projectIntent/modes/technical/conversation/projectIntentTechnicalBootstrap.js
src/core/projectIntent/projectIntentConversationRepoStore.js
```

Current role:

```text
Uses legacy snapshot and repo store.
Bootstrap depends on routeKey=sg_core_internal_read_allowed.
Uses process.env.GITHUB_TOKEN in legacy Technical Mode repo conversation.
```

Risk:

```text
This is not the new Living SG source proof path.
It does not produce sourceResultEnvelope as the canonical proof object.
```

Allowed short-term:

```text
Keep as legacy compatibility only.
Do not connect it as Living SG repo-read runtime.
```

Future replacement:

```text
LivingRepoSourceProviderBoundary -> sourceResultEnvelope -> SOURCE RESULT SYSTEM EVIDENCE.
```

---

## 4. Capability mapping for future Living SG replacement

Legacy behavior should be replaced by capabilities, not by commands.

```text
repo_status
-> living_repo_status_read

show_tree
-> living_repo_tree_read

browse_folder
-> living_repo_folder_read

find_target
-> living_repo_search

open_target
-> living_repo_file_read

find_and_explain
-> living_repo_search_then_analyze

explain_target / explain_active
-> living_repo_file_analyze

continue_active
-> living_contextual_continuation

answer_pending_choice
-> living_choice_resolution
```

All future capabilities must follow:

```text
meaning
-> intent
-> capability need
-> permission / scope gate
-> source request
-> sourceResultEnvelope
-> source proof
-> answer/action
```

---

## 5. What must NOT be done next

Do not:

```text
- reconnect diagnostic natural bridge
- add a new technical natural bridge under another name
- add slash commands as Living SG intelligence
- expand projectIntent fallback phrase maps
- connect repo-read runtime directly from normal chat
- connect RepoStateAgent runtime without gate
- add executor
- deploy
- treat legacy snapshot as final source-proof model
- treat projectIntent route metadata as proof
- treat sourceResultEnvelope as write permission
```

---

## 6. Recommended next skeleton

Next safe skeleton should be:

```text
src/core/living-sg/LivingRepoSourceProviderBoundary.js
```

Purpose:

```text
- define how future repo source providers return repo facts into Living SG;
- normalize provider output into sourceResultEnvelope shape;
- keep provider boundary separate from execution;
- do not read repo yet;
- do not call RepoStateAgent yet;
- do not use GITHUB_TOKEN yet;
- do not write repo;
- do not create executor.
```

Possible contract:

```text
createLivingRepoSourceProviderBoundary(input)
-> providerPlan
-> expectedSourceResultEnvelope
-> canReadRepo=false
-> canWriteRepo=false
-> canExecute=false
-> requiresRuntimeProvider=true
```

This keeps skeleton -> config -> logic order.

---

## 7. Suggested migration sequence

### Step A — docs-only audit

```text
This file.
No runtime change.
```

### Step B — disconnected skeleton

```text
Create LivingRepoSourceProviderBoundary.js.
No runtime connection.
No source calls.
No repo reads.
```

### Step C — smoke contract

```text
Add smoke test for boundary shape.
Verify no execution, no write, no RepoStateAgent runtime.
```

### Step D — soft prompt evidence compatibility

```text
Only after skeleton is stable:
allow future provider output to be adapted into sourceResultEnvelope.
Still no repo-read runtime.
```

### Step E — runtime provider design

```text
Only after monarch approval:
design which provider reads repo facts:
- legacy snapshot adapter
- GitHub provider
- RepoStateAgent provider
```

No provider should bypass sourceResultEnvelope.

---

## 8. Current conclusion

Current state is safe enough to continue, but not final:

```text
legacy technical natural bridge: blocked
legacy projectIntent: isolated but still active
repo conversation: still legacy compatibility
Living SG source proof path: exists for sourceResult evidence
future repo-read runtime: not connected
```

Next safe move is a disconnected Living repo source provider boundary skeleton, not runtime execution.
