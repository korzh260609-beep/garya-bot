# ROADMAP SPLIT INDEX — SG AI SYSTEM

This directory contains the active split version of `pillars/ROADMAP.md`.

Purpose:
- keep roadmap aligned with the active split workflow;
- avoid one very large roadmap file;
- separate early memory foundation from later memory consumers;
- preserve old `pillars/ROADMAP.md` as inactive legacy;
- preserve SG entity integrity during planning;
- preserve the controlled-action philosophy from `pillars/DECISIONS.md`.

This roadmap must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/README.md`
- `pillars/workflow/README.md`

Important:
- `pillars/DECISIONS.md` is the single root decisions file.
- `pillars/DECISIONS.md` is the upper philosophical and architectural foundation for SG.
- Roadmap files define implementation order, not SG philosophy.
- If roadmap conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` wins.

## Active roadmap files

1. `00_RULES_AND_ORDER.md`
   - global roadmap rules
   - canonical order
   - memory-priority clarification
   - active source-of-truth rules

2. `01_STAGE_01_06_CORE.md`
   - Stage 1 to Stage 6
   - infrastructure, DB, access, identity, observability, transport

3. `02_STAGE_07_MEMORY.md`
   - Stage 7 Memory Layer V1
   - Stage 7A Project Memory Core
   - Stage 7B Chat History Core

4. `03_STAGE_08_12_FOUNDATION.md`
   - Stage 8A to Stage 12
   - recall, already-seen, answer modes, sources, access expansion, file intake

5. `04_STAGE_13_20_ADVANCED.md`
   - Stage 13 to Stage 20
   - initiative, PR/DIFF, real integrations, multi-model, hybrid intelligence, legal/billing, risk/market protection, psych module
   - Critical Fixation appendix

## Safety rule

The old `pillars/ROADMAP.md` is not deleted.
It is kept only for historical continuity and must not be used as the active roadmap when split roadmap files exist.

Archived or old roadmap files must not be treated as current roadmap truth.

## Active source of truth

For current planning and development order, use only:
- `pillars/roadmap/00_RULES_AND_ORDER.md`
- `pillars/roadmap/01_STAGE_01_06_CORE.md`
- `pillars/roadmap/02_STAGE_07_MEMORY.md`
- `pillars/roadmap/03_STAGE_08_12_FOUNDATION.md`
- `pillars/roadmap/04_STAGE_13_20_ADVANCED.md`

If old `pillars/ROADMAP.md` conflicts with split roadmap, the split roadmap wins for roadmap order.

If split roadmap conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` wins for SG philosophy and global architecture direction.

## SG entity rule

Roadmap planning must preserve:

```text
SG = global project entity / global intellectual system
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
minimal controller/gate = action protection layer, not SG brain
```

Human Mode, Technical Mode, RepoStateAgent, agents, tools, transports, memory, sources, capability selectors, controller/gate layers and future interfaces are components/instruments of SG.
They must not be planned as separate SG entities.

## Minimal controller / capability access rule

Roadmap planning must preserve:

```text
Reasoning model / meaning provider understands meaning.
Minimal controller/gate protects actions, permissions, scope, sources, risks, costs and confirmations.
Heavy SemanticRouter as a separate SG brain is not the goal.
Capability access != authority to redefine SG.
```

No roadmap item may silently authorize:
- connecting Human Mode runtime without gate;
- building a heavy router that replaces reasoning model intelligence;
- treating controller/gate as a separate SG brain;
- converting old phrase/keyword/regex routes into Human Mode intelligence;
- bypassing permissions, source checks, risk checks or confirmations;
- treating capability access as governance authority.

## Memory priority

Current priority:
1. Project Memory Core
2. Long-Term Memory Core
3. Controlled Memory Read/Write
4. Auto-restore before project/repo work

Memory core is early foundation.
Memory consumers remain later feature layers.
