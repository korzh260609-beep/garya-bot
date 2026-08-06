# SG 2.1 ROADMAP

This directory defines only **what is built and in what dependency order**. It does not contain runtime history, completion markers, deployment notes or implementation procedure.

## Authority

```text
DECISIONS → ARCHITECTURE → ROADMAP → WORKFLOW → CODE → TEST/RUNTIME EVIDENCE
```

## Active order
1. `00_RULES_AND_ORDER.md` — roadmap laws and gates
2. `01_STAGE_01_06_CORE.md` — Semantic Kernel
3. `02_STAGE_07_MEMORY.md` — Context and Memory
4. `03_STAGE_08_12_FOUNDATION.md` — Decision, Safety and Capabilities
5. `04_STAGE_13_20_ADVANCED.md` — Interfaces, Automation and Domain Modules

## Rules
- SG 2.1 starts from meaning, not Telegram, commands, database or deployment platform.
- Natural language is the primary interface.
- Transports are added after the platform core.
- Domain modules never define core architecture.
- Completion is determined only from code, tests and runtime evidence.
- Historical SG 2.0 material remains available through Git history and `archive/` references.
