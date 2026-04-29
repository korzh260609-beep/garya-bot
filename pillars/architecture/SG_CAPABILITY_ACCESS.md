# SG_CAPABILITY_ACCESS.md

## Purpose

This file defines the rule that useful SG capabilities must become accessible through SG itself, not only through developer-only helpers or external tools.

This file must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md`
- `pillars/architecture/README.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/PERMISSIONS_MAP.md`
- `pillars/architecture/DATA_FLOW.md`

---

## Core rule

Everything useful created inside SG must become accessible through SG.

SG is the global project entity and the user-facing Advisor entity.

Internal capabilities must not be designed only for external helpers, developer-only usage, raw scripts, or isolated diagnostic commands.

Correct model:

```text
SG = global project entity
capability = component/instrument of SG
transport = access channel to SG
external helper = temporary support tool, not SG itself
```

Incorrect model:

```text
capability = separate SG
external helper = final user interface
developer command = normal Human Mode experience
component access = authority to redefine SG
```

---

## Applies to

This rule applies to:

- agents
- modules
- tools
- sources
- memory types
- project memory
- reports
- diagnostics
- integrations
- task engine
- document/file intake
- RepoStateAgent
- Human Mode capabilities
- Technical Mode diagnostics
- future services

---

## Monarch access

The Monarch owns SG and must be able to interact with SG and its capabilities through supported transports:

- Telegram
- future web/client UI
- Discord or other chat transports
- future voice/document interfaces
- controlled project tools

Monarch access means the Monarch can control and use SG capabilities according to governance and pillars.

However, even Monarch-facing capability access should remain:

- explicit,
- permission-aware,
- logged where appropriate,
- compatible with accepted decisions,
- consistent with skeleton -> config -> logic.

---

## Non-monarch access

Non-monarch users may receive bounded access to capabilities.

This does not grant them authority over:

- SG identity,
- SG architecture,
- accepted decisions,
- source-of-truth policy,
- project memory governance,
- Human Mode / Technical Mode boundaries,
- RepoStateAgent factual-source policy.

Bounded feature access must stay separate from governance authority.

---

## Required Human Mode flow

For normal user-facing access:

```text
Monarch/user
-> transport adapter
-> SG Human Mode
-> meaning/context/permission check
-> internal capability
-> SG response builder
-> transport adapter
-> Monarch/user
```

The user should speak in normal human language.

SG is responsible for translating the request into internal capability calls when safe and allowed.

---

## Required Technical Mode flow

For explicit commands, diagnostics, tests and legacy surfaces:

```text
Monarch/operator
-> transport adapter
-> SG Technical Mode
-> explicit command/diagnostic route
-> internal capability or diagnostic surface
-> technical output
```

Technical Mode may require exact syntax.
That is acceptable because it is a technical/control interface, not the normal Human Mode experience.

---

## Forbidden flow

```text
Monarch/user
-> external helper or raw developer command
-> internal capability bypassing SG
```

Also forbidden:

```text
user-facing capability
-> bypasses permissions
-> bypasses SG meaning/context
-> bypasses source-of-truth policy
-> presents external helper/tool as SG itself
```

---

## Capability access vs SG governance

Access to a capability is not the same as authority over SG.

Examples:

```text
repo.inspect permission ≠ right to change SG architecture
source.test permission ≠ right to redefine source-first policy
diagnostics.view permission ≠ decision authority
task.run permission ≠ autonomous governance power
AI/model access ≠ SG identity ownership
```

Governance-sensitive actions must follow `PERMISSIONS_MAP.md` and accepted decisions.

---

## Practical rule

When we create an agent, module, source, memory type, report, diagnostic tool or integration, we must plan how SG will expose it to the Monarch/user in normal human language where appropriate.

Developer commands and AgentWorkspace may exist for testing and diagnostics, but they are not the final user interface.

Every new capability should answer:

1. Is this Human Mode, Technical Mode, or both?
2. Who may access it?
3. What source/tool does it depend on?
4. What permissions are required?
5. What failure state must be visible?
6. How does it remain a component of SG, not a separate SG?

---

## Current guardrail

This file does not authorize connecting Human Mode runtime by itself.

Current Human Mode project/repo capability access remains gated by:

- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
- `pillars/architecture/PERMISSIONS_MAP.md`

Global SemanticRouter is not authorized by this file.
