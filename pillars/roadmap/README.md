# SG 2.1 ROADMAP

Roadmap defines what is built, dependency order, gates and acceptance boundaries. Each file is one independently verifiable and reversible roadmap block.

## Order
0. `00_ENGINEERING_FOUNDATION.md`
1. `00_PRINCIPLES_AND_GATES.md`
2. `01_SEMANTIC_KERNEL.md`
3. `02_CONTEXT_AND_MEMORY.md`
4. `03_DECISION_ENGINE.md`
5. `04_ACTION_GATE.md`
6. `05_CAPABILITY_SYSTEM.md`
7. `06_IDENTITY_AND_SCOPE.md`
8. `07_OBSERVABILITY.md`
9. `08_INTERFACES.md`
10. `09_AUTOMATION_AND_AGENTS.md`
11. `10_DOMAIN_MODULES.md`

## Foundation rule
Before Semantic Kernel implementation begins, Block 0 establishes the repository, test and CI baseline plus minimal canonical `IdentityContext`, `ScopeContext` and `TraceContext` contracts.

These foundation contracts exist only to make every later request scoped and traceable from the first executable slice. Production identity linking, role/grant resolution, durable audit storage, telemetry backends and retention remain in Blocks 6 and 7.
