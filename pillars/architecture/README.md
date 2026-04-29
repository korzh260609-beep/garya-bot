# pillars/architecture — Architecture Index

This folder contains active architecture documents for SG.

Architecture documents must be interpreted together with the core pillars:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/decisions/README.md`
- `pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md`

---

## Core architectural principle

SG is the global project entity.

All architecture must preserve this relation:

```text
SG = global project entity
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
```

No architecture document may redefine a component, mode, agent, transport, model, capability, route, or tool as an independent SG.

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
No mixing.
```

### SEMANTIC_ROUTING.md

Defines the meaning-first routing principle for SG.

Current guardrail:

```text
Global SemanticRouter is future architecture.
Do not build it now.
Human Mode skeleton comes first.
Old phrase/keyword/regex logic remains Technical Mode unless replaced by verified Human Mode architecture.
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

Current status:

```text
Runtime not connected.
Raw text not classified.
Global SemanticRouter not created.
Gated meaning provider exists.
Gated RepoStateAgent runner exists.
Smoke-check covers contracts.
```

### REPO_MAP_SOURCE_POLICY.md

Defines the factual source policy for current repository state.

Hard rule:

```text
RepoStateAgent is the only factual source for current repository state, project map, semantic map, module grouping, architecture health, and project status claims.
```

RepoStateAgent is a factual observation subsystem of SG, not a separate SG.

### SG_CAPABILITY_ACCESS.md

Defines how useful capabilities become accessible through SG.

Hard rule:

```text
capability access != authority to redefine SG.
external helper != final user interface.
```

Capabilities must be exposed through Human Mode and/or Technical Mode according to permissions, gates, and stage rules.

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

### From SG_ENTITY.md

```text
SG is the global project entity.
Components do not replace SG.
SG accumulates its own project experience.
```

### From SG_BEHAVIOR.md

```text
meaning -> intent -> decision -> action -> response
```

Forbidden:

```text
keyword -> reflex response
```

### From PROJECT.md

```text
Transport Layer -> Core / Task Engine -> Memory & Context Layer -> Sources Layer -> AI Layer -> Delivery
```

SG is platform-independent and source-first.

### From DECISIONS.md

Architecture changes require explicit governance.

Relevant decisions:

- D-009: skeleton -> config -> logic
- D-010: no architecture changes on the fly
- D-016: system correctness overrides AI intelligence
- D-017: SG Code-AI operates in analysis/suggestion mode only
- D-019: pillars are source of truth, not chat logs
- D-038: project memory and long-term memory core are early foundation
- D-039: SG global entity and component alignment

---

## Current implementation guardrails

Current Human Mode architecture work must keep these guardrails:

1. Do not connect Human Mode to runtime until explicitly approved.
2. Do not build a global SemanticRouter yet.
3. Do not add phrase/keyword/regex routes to Human Mode.
4. Do not use old RepoIndex as current factual truth.
5. Do not treat RepoStateAgent as a separate SG.
6. Do not let external AI operators own SG decisions, identity, memory, or project experience.
7. Do not treat capability access as governance authority.
8. Keep smoke-checks green after every contract change.
9. Create snapshots after verified green states.

---

## Practical reading order

For architecture work, read in this order:

1. `pillars/SG_ENTITY.md`
2. `pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md`
3. `pillars/SG_BEHAVIOR.md`
4. `pillars/PROJECT.md`
5. `pillars/DECISIONS.md`
6. `pillars/architecture/README.md`
7. `pillars/architecture/SG_INTERFACE_LAYERS.md`
8. `pillars/architecture/SEMANTIC_ROUTING.md`
9. `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
10. `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
11. `pillars/architecture/SG_CAPABILITY_ACCESS.md`
12. relevant architecture maps: `MODULE_MAP.md`, `DATA_FLOW.md`, `PERMISSIONS_MAP.md`, `CODE_OWNERSHIP_MAP.md`
