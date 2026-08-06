# SG 2.1 ROADMAP

Roadmap defines what is built, dependency order, gates and acceptance boundaries. Blocks 0–10 are documented as individual roadmap files. The production continuation is documented canonically in `PRODUCTION_ROADMAP.md`, which contains Blocks 11–19 and Pilot Launch as one coordinated production program.

## Order
0. `00_ENGINEERING_FOUNDATION.md`
1. `00_PRINCIPLES_AND_GATES.md`
2. `01_SEMANTIC_KERNEL.md`
3. `02_CONTEXT_AND_MEMORY.md`
4. `02_5_AI_ROUTING_FOUNDATION.md`
5. `03_DECISION_ENGINE.md`
6. `04_ACTION_GATE.md`
7. `05_CAPABILITY_SYSTEM.md`
8. `06_IDENTITY_AND_SCOPE.md`
9. `07_OBSERVABILITY.md`
10. `08_INTERFACES.md`
11. `09_AUTOMATION_AND_AGENTS.md`
12. `10_DOMAIN_MODULES.md`
13. `PRODUCTION_ROADMAP.md`
14. `11_RUNTIME_COMPOSITION.md` — implementation and acceptance evidence for Block 11
15. `12_POSTGRESQL_PERSISTENCE.md` — implementation and acceptance evidence for Block 12

## Production continuation

`PRODUCTION_ROADMAP.md` is the canonical continuation after Block 10 and fixes the implementation order as:

1. Block 11 — Runtime Composition
2. Block 12 — PostgreSQL Persistence
3. Block 13 — Durable Automation and Workers
4. Block 14 — Telegram Production Integration
5. Block 15 — Production AI Integration
6. Block 16 — Production Capabilities
7. Block 17 — Render Deployment
8. Block 18 — End-to-End Verification
9. Block 19 — Security and Operations
10. Pilot Launch

Each production block must still be independently verifiable, reversible and completed through code, tests, documentation, CI and runtime evidence.

## Foundation rule
Before Semantic Kernel implementation begins, Block 0 establishes the repository, test and CI baseline plus minimal canonical `IdentityContext`, `ScopeContext` and `TraceContext` contracts.

These foundation contracts exist only to make every later request scoped and traceable from the first executable slice. Production identity linking, role/grant resolution, durable audit storage, telemetry backends and retention remain in Blocks 6 and 7.

## AI routing gate
Block 2.5 connects the production reasoning path through AI Router after Semantic Kernel and Context and Memory are stable, but before Decision Engine development begins. Until Block 2.5 is implemented, only fixture-based reasoning is allowed in tests and local development.
