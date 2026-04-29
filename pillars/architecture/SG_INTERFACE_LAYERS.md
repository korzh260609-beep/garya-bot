# SG_INTERFACE_LAYERS.md

## Core rule

SG has two strictly separated interface modes:

1. Human Mode — the main user-facing SG mode.
2. Technical Mode — explicit slash commands, exact phrase/word routes, debug commands and system diagnostics.

These modes must not be mixed.

This file is an architecture-level implementation of the following pillars:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

---

## 0) Entity alignment

SG is the global project entity.

Human Mode and Technical Mode are interface modes of SG, not separate SG entities.

Human Mode, Technical Mode, RepoStateAgent, diagnostics, commands, transports, memory, modules, sources, task engine, external agents, and future interfaces are components or instruments of SG.

They must not be treated as independent replacements for SG itself.

The purpose of interface separation is to protect SG’s entity integrity:

```text
SG = global project entity
Human Mode = natural meaning-first interface of SG
Technical Mode = explicit diagnostics / commands / legacy interface of SG
RepoStateAgent = factual repo observation subsystem of SG
```

Any implementation that makes a mode, command route, bot, model, or agent behave as a separate “SG” is architecturally wrong.

---

## 1) Human Mode

Human Mode is the main and preferred way to use SG.

The user speaks naturally.
SG must understand meaning, context, role, permissions and available capabilities.

Required flow:

```text
user says naturally what they want
-> SG understands meaning
-> SG checks context and permissions
-> SG selects internal capability
-> SG executes or answers
-> SG replies in human language
```

Human Mode must not require slash commands, coded phrases, exact keywords or internal protocol.

Human Mode is not a separate agent. It is SG’s normal meaning-first user interface.

This follows the Meaning-First rule from `SG_ENTITY.md` and `SG_BEHAVIOR.md`:

```text
meaning -> intent -> decision -> action -> response
```

Forbidden simplification:

```text
keyword -> reflex response
```

---

## 2) Technical Mode

Technical Mode includes:

- slash commands
- exact debug commands
- exact phrase-bound routes
- exact word-bound routes
- regex/keyword-triggered routes
- system diagnostics
- AgentWorkspace commands
- Render/GitHub test commands
- legacy repo commands
- old repo/index commands

Technical Mode exists for:

- testing
- diagnostics
- development
- debugging
- backward compatibility
- controlled system operations

Technical Mode may require exact syntax.
That is acceptable because it is a technical interface.

Technical Mode is not SG’s intelligence layer. It is SG’s explicit technical/control interface.

---

## 3) Hard separation rule

All slash commands and all exact word/phrase-bound behavior belong to Technical Mode.

They must work only as explicit technical commands/routes.

They must not be treated as normal Human Mode communication.

Forbidden:

```text
normal human request
-> old word/phrase route
-> old command handler
-> template answer as SG intelligence
```

Required:

```text
normal human request
-> Human Mode
-> meaning/context/permissions
-> correct internal capability
-> human answer
```

---

## 4) No soft mixing for now

Do not convert old word/phrase routes into weak semantic signals at this stage.

Current rule:

```text
old slash/word/phrase/regex logic = Technical Mode
```

Human Mode must be built separately and clearly.

This prevents confusion between legacy command behavior and real SG communication.

---

## 5) Repository/project work

For repo/project work:

Human Mode must use RepoStateAgent as the factual source of current repository state.

Technical Mode may still expose old repo commands for compatibility and diagnostics, but old RepoIndex and old handlers must not be presented as current factual truth.

Current factual source of truth for repository state:

```text
RepoStateAgent
-> RepoStateCollector
-> RepoStateProjectMapBuilder
-> RepoStateSemanticMapBuilder
```

RepoStateAgent is not a separate SG. It is one factual observation subsystem of SG.

This follows:

- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
- `pillars/SG_ENTITY.md`
- `pillars/PROJECT.md`

---

## 6) Migration rule

Do not delete old code now.

Old command/keyword/phrase systems are moved conceptually into Technical Mode.

Allowed actions later:

1. keep as explicit Technical Mode command;
2. adapt to call new agents internally while remaining Technical Mode;
3. remove carefully only after replacement is verified and Monarch approves.

This follows `DECISIONS.md` and the behavior rule that SG must not change architecture or delete logic without explicit instruction.

---

## 7) Final formula

```text
SG = global project entity.
Human Mode = normal SG conversation by meaning.
Technical Mode = explicit commands/tests/debug/legacy routes.
RepoStateAgent = factual repo observation subsystem of SG.
No mixing.
No deletion now.
No component replaces SG itself.
```
