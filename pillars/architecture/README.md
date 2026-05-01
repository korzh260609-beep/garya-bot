# pillars/architecture — Architecture Index

This folder contains active architecture documents for SG.

Architecture documents must be interpreted together with the core pillars:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`

Important:
- `pillars/DECISIONS.md` is the single root decisions file.
- `pillars/DECISIONS.md` is the upper philosophical and architectural foundation for SG.
- `pillars/decisions/` is not an active root decisions folder unless a future accepted rule reactivates it.
- Deleted decision-extension files must not be referenced as active architecture truth.

---

## Core architectural principle

SG is the global project entity and global intellectual system.

Current runtime, Telegram bot, commands, agents, routes, tools, and repository helpers are not SG itself.
They are implementation components and access layers.

All architecture must preserve this relation:

```text
SG = global project entity / global intellectual system
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
minimal controller/gate = action protection layer, not SG brain
```

No architecture document may redefine a component, mode, agent, transport, model, capability, route, controller, or tool as an independent SG.

---

## Active architecture documents

### SG_INTERFACE_LAYERS.md

Defines SG interface modes:

```text
Human Mode = normal SG conversation by meaning
Technical Mode = explicit commands/tests/debug/legacy routes
```

Hard rule:

```text
No identity mixing.
```

Human Mode and Technical Mode are interfaces/components of SG.
They are not separate SG entities.

### SEMANTIC_ROUTING.md

Defines the meaning-first routing/control principle for SG.

Current guardrail:

```text
Semantic routing must be a minimal controller/gate layer.
It must not replace reasoning model intelligence.
It must not become a separate SG brain.
Old phrase/keyword/regex logic remains Technical Mode unless replaced by verified meaning-first behavior.
```

Correct role:

```text
reasoning model understands meaning
-> minimal controller checks scope / permissions / capability / source / risk
-> SG answers or performs only the permitted action
```

### HUMAN_MODE_REPOSTATEAGENT_SKELETON.md

Defines the safe Human Mode repository/project-work skeleton:

```text
HumanEntry
-> Permissions
-> Meaning
-> RepoFacts
-> CapabilitySelector
-> ResponseBuilder
```

Current status must be interpreted through `DECISIONS.md`:

```text
Human Mode runtime must remain gated.
Raw text classification must not bypass permissions/scope checks.
Heavy Global SemanticRouter is not the goal.
Gated meaning provider exists or may exist as a controlled helper.
Gated RepoStateAgent runner exists or may exist as a factual helper.
Smoke-checks must cover contracts when they exist.
```

### REPO_MAP_SOURCE_POLICY.md

Defines the factual source policy for current repository state.

Hard rule:

```text
RepoStateAgent is the factual source for current repository state, project map, semantic map, module grouping, architecture health, and project status claims when available and verified.
```

RepoStateAgent is a factual observation subsystem of SG, not a separate SG.

### AGENT_DIRECTORY_STRUCTURE.md

Defines the future canonical directory structure for SG agents.

Hard rule:

```text
agents must be grouped by meaning/responsibility
one agent must not be hidden inside another agent folder
agents are SG components, not separate SG entities
```

Current future groups:

```text
src/agents/repo-intelligence/repo-state-agent/
src/agents/repo-maintenance/repo-maintenance-agent/
src/agents/runtime-diagnostics/diagnostics-render-agent/
src/agents/user-product/
src/agents/shared/bridges/
```

### REPO_MAINTENANCE_AGENT_SKELETON.md

Defines the future RepoMaintenanceAgent skeleton.

Purpose:

```text
After repository changes, detect what else must be checked, synchronized, updated, tested, or snapshotted.
```

Hard rule:

```text
RepoMaintenanceAgent starts as a read-only auditor/planner.
It must not replace RepoStateAgent.
It must not become DiagnosticsRenderAgent.
It must not auto-edit code or pillars by default.
```

### SG_CAPABILITY_ACCESS.md

Defines how useful capabilities become accessible through SG.

Hard rule:

```text
capability access != authority to redefine SG.
external helper != final user interface.
```

Capabilities must be exposed through Human Mode and/or Technical Mode according to permissions, gates, stage rules, and the controlled-action philosophy in `DECISIONS.md`.

### MODULE_MAP.md

Defines logical SG modules and their responsibility domains.

Hard rule:

```text
modules = components of SG, not separate SG entities.
```

### DATA_FLOW.md

Defines canonical high-level data flows between SG components.

Hard rule:

```text
data flow connects SG components; it must not create separate SG identities.
```

### PERMISSIONS_MAP.md

Defines high-level permissions and access-control architecture.

Hard rule:

```text
component access != authority over SG identity/governance.
permissions protect actions; they do not limit SG thinking.
```

### CODE_OWNERSHIP_MAP.md

Defines high-level code ownership boundaries.

Hard rule:

```text
code ownership = responsibility boundary, not SG identity ownership.
```

---

## Cross-pillar alignment

Architecture must follow:

### From DECISIONS.md

```text
SG is free in thinking.
SG is controlled in actions.
SG is a global intellectual system, not the current bot/runtime.
Semantic routing is a minimal controller/gate, not a replacement for model reasoning.
Agents are tools/components of SG, not SG itself.
```

Relevant decisions:

- D-000: SG is a free-thinking system with controlled actions
- D-001: SG is the global project entity
- D-002: SG is a multiuser system of personal entities
- D-003: monarch control does not mean unrestricted default access to private user memory
- D-004: `global_user_id` is the root of personal logic
- D-005: Gary's project is not default for ordinary users
- D-006: workflow and sources are meaning providers, not fixed paths
- D-007: capabilities replace permanent hardcoded allowlists/blacklists
- D-008: commands are interface shortcuts, not SG essence
- D-009: SG must not be trapped by regex
- D-010: semantic routing must remain a minimal controller/gate layer
- D-011: Chat History, Memory, and Project Memory are different layers
- D-012: AI is not a source of truth
- D-013: AI calls go through centralized router/wrapper
- D-014: Repo/code AI works in analysis/suggestion mode
- D-015: RepoStateAgent is a repo facts component, not SG
- D-016: agents are SG tools, not SG itself
- D-017: user isolation is more important than convenience
- D-020: stage gates limit implementation, not thinking

### From SG_ENTITY.md

```text
SG is the global project entity.
Components do not replace SG.
SG accumulates its own project experience.
```

### From SG_BEHAVIOR.md

```text
meaning -> intent -> context -> capability -> permission -> source/tool -> action/answer
```

Forbidden:

```text
keyword -> reflex response
```

### From PROJECT.md

```text
Meaning -> Intent -> Context -> Capability -> Source/Tool -> Processing -> Result/Action -> Delivery
```

SG is platform-independent, source-first, personal-SG ready, and not reducible to the current Telegram/runtime implementation.

---

## Current implementation guardrails

Current Human Mode / architecture work must keep these guardrails:

1. Do not connect Human Mode runtime without explicit approval and gates.
2. Do not build a heavy router that replaces reasoning model intelligence.
3. Do not treat a routing/controller layer as a separate SG brain.
4. Do not add phrase/keyword/regex routes to Human Mode as if they were meaning-first intelligence.
5. Do not use old RepoIndex as current factual truth.
6. Do not treat RepoStateAgent as a separate SG.
7. Do not let external AI operators own SG decisions, identity, memory, or project experience.
8. Do not treat capability access as governance authority.
9. Do not hide one agent inside another agent folder.
10. Do not make RepoMaintenanceAgent auto-edit code or pillars by default.
11. Keep smoke-checks green after every contract change.
12. Create snapshots after verified green states.

---

## Practical reading order

For architecture work, read in this order:

1. `pillars/DECISIONS.md`
2. `pillars/SG_ENTITY.md`
3. `pillars/SG_BEHAVIOR.md`
4. `pillars/PROJECT.md`
5. `pillars/architecture/README.md`
6. `pillars/architecture/SG_INTERFACE_LAYERS.md`
7. `pillars/architecture/SEMANTIC_ROUTING.md`
8. `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
9. `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
10. `pillars/architecture/AGENT_DIRECTORY_STRUCTURE.md`
11. `pillars/architecture/REPO_MAINTENANCE_AGENT_SKELETON.md`
12. `pillars/architecture/SG_CAPABILITY_ACCESS.md`
13. relevant architecture maps: `MODULE_MAP.md`, `DATA_FLOW.md`, `PERMISSIONS_MAP.md`, `CODE_OWNERSHIP_MAP.md`
