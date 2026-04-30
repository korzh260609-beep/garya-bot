# HUMAN_MODE_REPOSTATEAGENT_SKELETON.md

## Purpose

This document defines the first skeleton for real SG Human Mode repository/project work.

It exists to prevent accidental mixing of:

```text
Human Mode
Technical Mode
legacy phrase/keyword/regex routing
old repo snapshot commands
heavy SemanticRouter-as-brain design
```

Human Mode must be built separately from legacy Technical Mode.

The goal is not to create a heavy Global SemanticRouter.
The goal is a safe Human Mode path where:

```text
reasoning model / meaning provider understands meaning
minimal controller/gate checks scope, permissions, capability, source/tool, risk, cost, confirmation
SG answers or performs only the permitted action
```

This document is an architecture-level implementation of:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/SEMANTIC_ROUTING.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## Entity alignment

SG is the global project entity and global intellectual system.

Human Mode is not a separate agent and not a separate “SG”.
It is SG’s normal meaning-first interface for natural user communication.

RepoStateAgent is not a separate SG either.
It is SG’s factual repository observation subsystem.

Minimal controller/gate is not a separate SG brain.
It is only an action protection and capability-selection layer.

The Human Mode RepoStateAgent skeleton must therefore be interpreted as:

```text
SG global entity / global intellectual system
-> Human Mode interface
-> reasoning model / meaning provider
-> minimal controller/gate
-> RepoStateAgent factual observation when repo facts are needed
-> SG response / permitted action
```

External AI operators, coding assistants, or temporary tools may help implement or verify this skeleton, but they do not become SG and do not own SG’s project experience.

---

## Core rule

Human Mode repository/project work must use RepoStateAgent-backed facts when current repo/project facts are required.

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
-> meaning / intent / context
-> role / scope / permission check
-> capability selection
-> source/tool need check
-> RepoStateAgent factual read when repo facts are needed
-> project/context reasoning
-> risk / cost / confirmation check
-> human-readable answer or permitted action
```

Canonical SG formula:

```text
meaning -> intent -> context -> capability -> permission -> source/tool -> action/answer
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
building a heavy router that replaces reasoning model intelligence
making RepoStateAgent, Human Mode, controller/gate, or any helper act as a separate SG
bypassing permissions, source checks, risk checks, or confirmations
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
call meaning layer
call permission/scope layer
call repo facts layer when needed
call capability selector
call response builder
return structured Human Mode result
```

Current implementation rule:
- not wired into runtime unless explicitly approved
- may be tested only through explicit smoke-check or controlled caller

### projectIntentHumanPermissions.js

Checks whether the user can access SG project/repo facts or perform the requested capability.

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
personal SG scope
project scope
```

Permissions protect actions and private data.
They must not limit SG’s ability to think, analyze, explain, or prepare non-applied plans.

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
It must not duplicate the reasoning model’s thinking with large hardcoded logic.

Current safe contract:
- raw text is not classified by keywords/regex
- structured meaning may be accepted from context or a gated meaning provider
- a meaning provider may be used only when explicitly gated

Gated provider rule:

```text
humanProjectIntentMeaningProvider may run only if allowHumanMeaningProviderRun === true
```

### projectIntentHumanRepoFacts.js

Loads RepoStateAgent-backed facts when repo/project facts are required.

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
prepare_non_applied_plan
```

Rules:
- selects from structured meaning, permissions, repo facts, context, and risk
- must not inspect raw text as keyword routing
- must not select project capabilities without required repo facts when facts are needed
- must be aware of permission/risk/confirmation needs
- must not perform the action itself

### projectIntentHumanResponseBuilder.js

Builds final human-readable answer.

Rules:
- no debug protocol unless explicitly requested
- uses repo facts + capability where relevant
- does not use old Technical Mode template replies as Human Mode intelligence
- states uncertainty or missing facts when needed
- may prepare a non-applied plan when action is not permitted

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
Runtime SG is not connected to Human Mode unless explicitly gated.
Raw text is not classified into intent by keyword/regex.
Heavy SemanticRouter is not created and is not the target.
Phrase/keyword/regex logic is not added to Human Mode.
```

---

## First safe implementation steps

Do not implement a full Human Mode router immediately.

Safe staged path:

1. Create/maintain Human Mode module skeletons.
2. Wire nothing into runtime without explicit gate.
3. Add smoke checks for imports and contracts.
4. Add gated meaning provider contract.
5. Add gated RepoStateAgent facts contract.
6. Add runner adapter with lazy import.
7. Add minimal controller/gate checks only where there is a real scope/permission/capability/source/risk/confirmation need.
8. Verify full pipeline through explicit controlled calls.
9. Only later connect HumanModeEntry behind an explicit controlled runtime gate.
10. Only after that allow selected natural repo/project questions to use Human Mode.

---

## Migration status

Current status:

```text
Technical Mode split: in progress / mostly done for projectIntent conversation layer
Human Mode: boundary and safe contracts exist
Human Mode runtime connection: not started unless explicitly gated
Real natural-language understanding provider: not connected unless explicitly gated
Heavy SemanticRouter: not created and not target
```

This file is the skeleton contract for the next phase.
