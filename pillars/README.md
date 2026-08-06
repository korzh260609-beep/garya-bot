# PILLARS — SG 2.1 CANONICAL INDEX

`pillars/` contains only active documentation required to build SG 2.1.

## Authority

```text
DECISIONS
→ ARCHITECTURE
→ ROADMAP
→ WORKFLOW
→ CODE
→ TEST / RUNTIME EVIDENCE
```

## Root files
- `DECISIONS.md` — accepted global decisions
- `SG_ENTITY.md` — system identity and boundaries
- `SG_BEHAVIOR.md` — behavior and action-control rules
- `PROJECT.md` — project purpose and success criteria
- `README.md` — this index

## Architecture
Entry: `architecture/README.md`

Active files:
- `SG21_SYSTEM.md`
- `SEMANTIC_KERNEL.md`
- `CONTEXT_AND_MEMORY.md`
- `DECISION_AND_ACTION_GATE.md`
- `CAPABILITY_SYSTEM.md`
- `IDENTITY_AND_SCOPE.md`
- `OBSERVABILITY.md`
- `TRANSPORTS_AND_AI_ROUTING.md`

## Roadmap
Entry: `roadmap/README.md`

Active files:
- `00_PRINCIPLES_AND_GATES.md`
- `01_SEMANTIC_KERNEL.md`
- `02_CONTEXT_AND_MEMORY.md`
- `03_DECISION_ENGINE.md`
- `04_ACTION_GATE.md`
- `05_CAPABILITY_SYSTEM.md`
- `06_IDENTITY_AND_SCOPE.md`
- `07_OBSERVABILITY.md`
- `08_INTERFACES.md`
- `09_AUTOMATION_AND_AGENTS.md`
- `10_DOMAIN_MODULES.md`

## Workflow
Entry: `workflow/README.md`

Active files:
- `DEVELOPMENT_PROTOCOL.md`
- `CHANGE_SPECIFICATION.md`
- `TEST_AND_EVIDENCE_PROTOCOL.md`
- `RELEASE_AND_ROLLBACK_PROTOCOL.md`
- `ARCHITECTURE_DECISION_PROTOCOL.md`

## Modules
`modules/` starts empty except for its README. Module documentation is created only when the corresponding SG 2.1 module is introduced through the active roadmap.

## Hard rule
Any file not listed by this index is not active SG 2.1 truth and must not be added under `pillars/` without explicit architectural purpose.
