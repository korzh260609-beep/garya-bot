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
return structured Human Mode result
```

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

### projectIntentHumanRepoFacts.js

Calls RepoStateAgent-backed facts.

Must not use old RepoIndex as factual current state.

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

### projectIntentHumanResponseBuilder.js

Builds final human-readable answer.

No debug protocol unless explicitly requested.

---

## First safe implementation step

Do not implement full Human Mode router immediately.

First safe step:

```text
create empty module skeletons
wire nothing into runtime
add tests or smoke checks later
```

Second step:

```text
connect HumanModeEntry only behind an explicit controlled call
```

Third step:

```text
connect RepoStateAgent facts
```

Fourth step:

```text
allow selected natural repo/project questions to use Human Mode
```

---

## Migration status

Current status:

```text
Technical Mode split: in progress / mostly done for projectIntent conversation layer
Human Mode: boundary exists, real implementation not started
```

This file is the skeleton contract for the next phase.
