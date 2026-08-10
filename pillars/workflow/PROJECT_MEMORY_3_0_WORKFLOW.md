# SG 2.1 — PROJECT MEMORY 3.0 WORKFLOW

## Purpose
Defines the implementation and verification procedure for Project Memory 3.0. It does not redefine architecture or roadmap order.

## Mandatory sequence for every PM3 stage

```text
scope
→ contracts
→ skeleton
→ config
→ minimal logic
→ tests
→ observability
→ safety review
→ architecture consistency check
→ reversible commit
→ CI/runtime evidence
```

## Rules
- Work only from the canonical `PROJECT_MEMORY_3_0.md` architecture and `PROJECT_MEMORY_3_0_PROGRAM.md` roadmap.
- Reuse Memory 2.0 scope/privacy/trust/provenance/lifecycle rules; do not create a parallel memory system.
- Preserve `global_user_id`, project/group/thread isolation and System Self Knowledge separation.
- No AI provider may be called directly; model-assisted memory work uses AI Router only.
- AI output cannot grant trust or directly mutate durable Project Memory.
- Raw chat cannot become verified project truth automatically.
- Every durable write must preserve source provenance and an idempotency/trace identity.
- No secrets may enter Project Memory payloads, prompts or ordinary telemetry.
- Project Memory cannot grant identity, role, permission, ownership or resource authority.
- Render must not be treated as an available live source until a real Render Connector is implemented and verified.
- Live-state claims must prefer current authoritative evidence when the appropriate connector/tool exists.

## Implementation order
Follow PM3.1 through PM3.12 in `../roadmap/PROJECT_MEMORY_3_0_PROGRAM.md`. Do not mark later stages complete because earlier interfaces merely exist.

## Stage evidence
Each stage must leave:
- implementation diff;
- contract/unit tests;
- integration tests where applicable;
- PostgreSQL migration/restart evidence where applicable;
- privacy/authorization negative tests;
- observability evidence;
- CI result;
- runtime evidence for production-facing behavior;
- documentation synchronization when architecture or contracts change.

## Required negative tests
At minimum verify:
- cross-project retrieval blocked;
- raw chat cannot self-confirm;
- model output cannot self-confirm;
- duplicate source event is idempotent;
- conflicting facts are not silently overwritten;
- superseded facts are excluded from ordinary current recall;
- unauthorized namespaces are excluded;
- secret-bearing content is rejected/redacted before durable memory/context;
- prompt-like instructions in stored/external text remain data;
- missing live connector produces uncertainty/unavailable evidence rather than invented current state;
- memory cannot alter roles/permissions/owner state.

## E2E acceptance workflow
Final acceptance must execute a real path:

```text
verified trusted source event
→ Project Memory candidate
→ confirmation policy
→ PostgreSQL active fact
→ process restart
→ normal SG user question
→ hybrid retrieval
→ Project Memory Context Guard
→ AI Router
→ answer grounded in retrieved project facts
```

The E2E suite must additionally exercise duplicate replay, conflict handling, temporal supersession and stale/live-evidence behavior.

## Completion rule
Project Memory 3.0 is complete only when PM3.1–PM3.12 acceptance gates are proven by code, tests, CI and runtime evidence. Documentation-only completion is forbidden.
