# D-039: SG global entity and component alignment

Status: ACCEPTED  
Date: 2026-04-29  
Scope: Identity / Architecture / Human Mode / Technical Mode / RepoStateAgent / Agents

---

## Decision

SG is the global project entity.

No bot, interface, module, mode, agent, prompt, model, tool, transport, repository subsystem, or external AI operator is SG by itself.

The following are components, instruments, interfaces, subsystems, or operators of SG:

- Telegram bot
- future web client
- API interfaces
- Human Mode
- Technical Mode
- RepoStateAgent
- task engine
- memory layers
- sources layer
- diagnostics
- external agent system
- external AI coding assistants
- future custom interfaces

They must not be treated as separate independent “SGs”.

Correct model:

```text
SG = global project entity
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
```

---

## Consequences

1. Architecture documents must describe Human Mode, Technical Mode, RepoStateAgent, agents, transports, memory, and tools as parts of SG, not as replacements for SG.

2. Human Mode is SG’s normal meaning-first interface.

3. Technical Mode is SG’s explicit command / diagnostics / legacy-control interface.

4. RepoStateAgent is SG’s factual repository observation subsystem.

5. External AI operators may help analyze, write, review, or diagnose, but they do not own SG’s identity, memory, decisions, or project experience.

6. SG project experience belongs to SG as the global project entity and must be preserved through durable project mechanisms:
   - pillars
   - decisions
   - architecture
   - code
   - memory
   - verified repository state
   - snapshots and recoverable history

7. Any implementation that makes a component act as a separate “SG” is architecturally incorrect.

8. Any implementation that treats old phrase/keyword/regex routes as SG intelligence instead of Technical Mode legacy/control surface is architecturally incorrect.

---

## Related pillars

This decision aligns and reinforces:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

---

## Non-goals

This decision does not connect Human Mode to runtime.

This decision does not create a global SemanticRouter.

This decision does not authorize autonomous AI changes, commits, deploys, or architecture modification without Monarch approval.

This decision does not delete legacy Technical Mode commands.
