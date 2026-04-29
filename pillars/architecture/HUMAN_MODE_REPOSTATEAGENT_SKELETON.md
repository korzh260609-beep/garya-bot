# HUMAN_MODE_REPOSTATEAGENT_SKELETON.md

## Purpose

This document defines the first skeleton for real SG Human Mode repository/project work.

It exists to prevent accidental mixing of:

```text
Human Mode
Technical Mode
legacy phrase/keyword/regex routing
old repo snapshot commands
```

Human Mode must be built separately from legacy Technical Mode.

This document is an architecture-level implementation of:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

---

## Entity alignment

SG is the global project entity.

Human Mode is not a separate agent and not a separate “SG”.
It is SG’s normal meaning-first interface for natural user communication.

RepoStateAgent is not a separate SG either.
It is SG’s factual repository observation subsystem.

The Human Mode RepoStateAgent skeleton must therefore be interpreted as:

```text
SG global entity
-> Human Mode interface
-> RepoStateAgent factual observation
-> SG response / action
```

External AI operators, coding assistants, or temporary tools may help implement or verify this skeleton, but they do not become SG and do not own SG’s project experience.

---

## Core rule

Human Mode repository/project work must use RepoStateAgent-backed facts.

Current factual chain:

```text
RepoStateAgent
-> RepoStateCollector
-> RepoStateProjectMapBuilder
-> RepoStateSemanticMapBuilder
```

Legacy systems are not factual Human Mode sources:

```text
old RepoIndex
old repo maps
old hardcoded maps
old command outputs
old snapshot-only replies
legacy phrase routes
legacy regex routes
```

They may remain in Technical Mode only.

---

## Human Mode target behavior

Human Mode must accept natural language:

```text
проверь архитектуру
что сейчас в проекте слабое
какой следующий шаг
что сломано в модуле памяти
объясни состояние проекта
покажи риск по repo layer
```

Human Mode must process it as meaning, not as exact commands.

Required flow:

```text
User natural request
-> HumanModeEntry
-> role / permission check
-> intent meaning classification
-> RepoStateAgent factual read
-> project/context reasoning
-> capability/action selection
-> human-readable answer
```

Canonical SG formula:

```text
meaning -> intent -> decision -> action -> response
```

Forbidden simplification:

```text
keyword -> reflex response
```

---

## Forbidden in Human Mode

Human Mode must not use:

```text
slash command routing
exact phrase routes
exact keyword routes
regex routes
old snapshot as current factual truth
old REPOINDEX as current factual truth
old hardcoded module maps as current factual truth
```

Also forbidden:

```text
copying Technical Mode heuristics into Human Mode
renaming old phrase logic as semantic intelligence
building a global SemanticRouter before the skeleton is stable
making RepoStateAgent, Human Mode, or any helper act as a separate SG
```

---

## Initial module skeleton

Future Human Mode code should be added as separate files, not mixed into old Technical Mode files.

Suggested structure:

```text
src/core/projectIntent/modes/human/
  projectIntentHumanEntry.js
  projectIntentHumanPermissions.js
  projectIntentHumanMeaning.js
  projectIntentHumanRepoFacts.js
  projectIntentHumanCapabilitySelector.js
  projectIntentHumanResponseBuilder.js
  projectIntentHumanRepoStateAgentRunner.js
```

Conversation-specific Human Mode files may stay under:

```text
src/core/projectIntent/modes/human/conversation/
```

But they must remain clean from phrase/keyword/regex logic.

---

## Responsibilities

### projectIntentHumanEntry.js

Entry point for natural SG project/repo requests.

Responsibilities:

```text
accept user text
accept user role/context
call permission layer
call meaning layer
call repo facts layer
call capability selector
call response builder
return structured Human Mode result
```

Current implementation rule:
- not wired into runtime
- may be tested only through explicit smoke-check or controlled caller

### projectIntentHumanPermissions.js

Checks whether the user can access SG project/repo facts.

For now:

```text
monarch/private access required for internal SG repo work
```

Future:

```text
citizen/project-specific permissions
guest limits
paid plans
workspace-level access
```

### projectIntentHumanMeaning.js

Meaning classification without exact phrase hacks.

Allowed output examples:

```text
repo_status_question
architecture_question
module_question
risk_question
next_step_question
file_or_area_question
unknown
```

This layer must not become a phrase router.

Current safe contract:
- raw text is not classified by keywords/regex
- structured meaning may be accepted from context
- a meaning provider may be used only when explicitly gated

Gated provider rule:

```text
humanProjectIntentMeaningProvider may run only if allowHumanMeaningProviderRun === true
```

### projectIntentHumanRepoFacts.js

Loads RepoStateAgent-backed facts.

Must not use old RepoIndex as factual current state.

Current safe contract:
- precomputed `context.repoStateAgentResult` may be normalized into Human Mode facts
- injected RepoStateAgent runner may run only when explicitly gated

Gated runner rule:

```text
repoStateAgentRunner may run only if allowHumanRepoStateAgentRun === true
```

### projectIntentHumanRepoStateAgentRunner.js

Creates an isolated future runner adapter for RepoStateAgent.

Rules:
- not wired into runtime by itself
- real RepoStateAgentService is lazy-imported only when needed
- mock service may be used for smoke-checks
- adapter requires Human Mode runner context

### projectIntentHumanCapabilitySelector.js

Selects what SG should do:

```text
answer_from_repo_state
explain_module
summarize_architecture
identify_risk
suggest_next_step
ask_clarification
```

Rules:
- selects from structured meaning and repo facts
- must not inspect raw text as keyword routing
- must not select project capabilities without repo facts

### projectIntentHumanResponseBuilder.js

Builds final human-readable answer.

Rules:
- no debug protocol unless explicitly requested
- uses repo facts + capability
- does not use old Technical Mode template replies as Human Mode intelligence

---

## Safe implementation status

Current safe implementation status:

```text
Human Mode skeleton files exist.
HumanEntry pipeline exists.
HumanMeaning supports gated provider contract.
HumanRepoFacts supports gated RepoStateAgent runner contract.
HumanRepoStateAgentRunner adapter exists with lazy import.
CapabilitySelector contract exists.
ResponseBuilder contract exists.
Smoke-check covers the contracts.
Runtime SG is not connected to Human Mode yet.
Raw text is not classified into intent yet.
Global SemanticRouter is not created.
Phrase/keyword/regex logic is not added.
```

---

## First safe implementation steps

Do not implement full Human Mode router immediately.

Safe staged path:

1. Create Human Mode module skeletons.
2. Wire nothing into runtime.
3. Add smoke checks for imports and contracts.
4. Add gated meaning provider contract.
5. Add gated RepoStateAgent facts contract.
6. Add runner adapter with lazy import.
7. Verify full pipeline through explicit controlled calls.
8. Only later connect HumanModeEntry behind an explicit controlled runtime gate.
9. Only after that allow selected natural repo/project questions to use Human Mode.

---

## Migration status

Current status:

```text
Technical Mode split: in progress / mostly done for projectIntent conversation layer
Human Mode: boundary and safe contracts exist
Human Mode runtime connection: not started
Real natural-language understanding provider: not connected
Global SemanticRouter: not created
```

This file is the skeleton contract for the next phase.
