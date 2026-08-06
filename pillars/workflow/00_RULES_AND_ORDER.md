# SG 2.1 WORKFLOW — DEVELOPMENT PROTOCOL

## Purpose
Provide one repeatable procedure for implementing any roadmap item without changing architecture on the fly.

## Universal sequence
1. Restore current project context.
2. Select exactly one roadmap item.
3. Read its governing architecture contracts.
4. Define goal, scope and non-goals.
5. Define acceptance criteria.
6. Create skeleton and interfaces.
7. Add configuration and feature flags.
8. Implement minimal logic.
9. Add contract and behavior tests.
10. Add observability.
11. Add safety controls.
12. Verify architecture boundaries.
13. Commit one reversible change block.
14. Record only durable factual documentation changes.

## Mandatory change specification
Every implementation block defines:
- goal
- scope
- non-goals
- inputs
- outputs
- dependencies
- risks
- permissions
- tests
- observability
- rollback
- acceptance criteria

## Hard rules
- skeleton → config → logic
- one logical change block → one reversible commit
- no architecture change without explicit monarch approval and DECISIONS entry
- no manual completion status in pillars
- no transport-specific logic in core
- no protected action bypass
- no hidden later-stage dependency
- no runtime history inside workflow files
