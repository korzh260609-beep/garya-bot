# WORKFLOW SPLIT INDEX — SG AI SYSTEM

This directory contains the active split workflow structure for SG.

It replaces reliance on one large flat workflow file for active work.

Purpose:
- avoid connector/output limits on one very large file;
- keep workflow readable and editable in smaller parts;
- preserve Stage 20 and EOF critical fixation;
- support the updated priority: Project Memory Core + Long-Term Memory Core first;
- preserve SG entity integrity during development;
- preserve semantic routing and capability access gates.

This workflow must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md`
- `pillars/architecture/README.md`
- `pillars/architecture/SEMANTIC_ROUTING.md`
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`

## Files

1. `00_RULES_AND_ORDER.md`
   - legend
   - memory order clarification
   - SG entity / component alignment
   - semantic routing / capability access gate alignment
   - hard rules
   - stage gates
   - execution protocol

2. `01_STAGE_01_06_CORE.md`
   - Stage 1 to Stage 6

3. `02_STAGE_07_MEMORY.md`
   - Stage 7
   - Stage 7A Project Memory Core
   - Stage 7B Chat History Core

4. `03_STAGE_08_12_FOUNDATION.md`
   - Stage 8A to Stage 12

5. `04_STAGE_13_20_ADVANCED.md`
   - Stage 13 to Stage 20
   - Critical Fixation appendix

## Safety rule

The old `pillars/WORKFLOW.md` is not deleted or overwritten by this split.
The split files are the safer editable working structure until the old large file is manually replaced or converted with full SHA visibility.

Current active workflow truth must come from this split structure unless a future accepted decision changes it.

Archived or old workflow files must not be treated as current workflow truth.

## SG entity rule

Workflow work must preserve:

```text
SG = global project entity
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
```

Human Mode, Technical Mode, RepoStateAgent, agents, tools, transports, memory and sources are components/instruments of SG.
They must not be developed as separate SG entities.

## Semantic routing / capability access rule

Workflow work must preserve:

```text
Human Mode skeleton first.
Global SemanticRouter later, only after explicit accepted gate.
Capability access != authority to redefine SG.
```

No workflow step may silently authorize:
- connecting Human Mode runtime without gate;
- building a global SemanticRouter now;
- converting old phrase/keyword/regex routes into Human Mode intelligence;
- treating capability access as governance authority.

## Memory priority

Current priority:
1. Project Memory Core
2. Long-Term Memory Core
3. Controlled Memory Read/Write
4. Auto-restore before project/repo work

Feature-specific memory consumers remain in their later stages:
- real GitHub/repo indexing;
- cross-group recall;
- risk module memory integration;
- billing/memory dashboard;
- legal export/delete flows.
