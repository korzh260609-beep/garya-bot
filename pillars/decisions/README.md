# pillars/decisions — Accepted Decision Extensions

This folder contains accepted decision files that extend the canonical decision system without requiring large rewrites of `pillars/DECISIONS.md`.

`pillars/DECISIONS.md` remains the main canonical decision document.

Files in this folder are also active decisions when they are explicitly marked:

```text
Status: ACCEPTED
```

---

## Purpose

This folder exists to keep new decisions:

- traceable,
- small enough to review safely,
- easy to link from architecture and pillar documents,
- protected from accidental corruption of the large `DECISIONS.md` file.

---

## Active decisions

### D-039: SG global entity and component alignment

File:

```text
pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md
```

Meaning:

```text
SG = global project entity.
Human Mode, Technical Mode, RepoStateAgent, agents, tools, memory, sources, transports and interfaces are SG components/instruments, not separate SG entities.
```

Related pillars:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

---

## Rules

1. Decision files in this folder must not be drafts.
2. Each file must include:
   - decision number,
   - status,
   - date,
   - scope,
   - decision,
   - consequences.
3. If a decision here contradicts `pillars/DECISIONS.md`, the conflict must be resolved explicitly.
4. Architecture files may link to decision files in this folder as accepted governance sources.
5. New decisions must not authorize runtime changes by themselves unless explicitly stated.
