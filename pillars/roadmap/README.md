# SG 2.1 ROADMAP

Roadmap defines what is built, dependency order, gates and acceptance boundaries. Each file is one independently verifiable and reversible roadmap block.

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

## Foundation rule
Before Semantic Kernel implementation begins, Block 0 establishes the repository, test and CI baseline plus minimal canonical `IdentityContext`, `ScopeContext` and `TraceContext` contracts.

These foundation contracts exist only to make every later request scoped and traceable from the first executable slice. Production identity linking, role/grant resolution, durable audit storage, telemetry backends and retention remain in Blocks 6 and 7.

## AI routing gate
Block 2.5 connects the production reasoning path through AI Router after Semantic Kernel and Context and Memory are stable, but before Decision Engine development begins. Until Block 2.5 is implemented, only fixture-based reasoning is allowed in tests and local development.
