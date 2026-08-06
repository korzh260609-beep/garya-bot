# SG 2.1 ROADMAP — BLOCKS 3 AND 4: DECISION, SAFETY AND CAPABILITIES

## Decision and Safety deliverables
- action classes
- ActionRequest contract
- identity and permission checks
- scope validation
- source/tool availability checks
- risk and cost policy
- confirmation policy
- idempotency
- audit trail
- safe conversion of blocked execution into analysis, simulation or prepare-only output

## Capability System deliverables
- Capability contract
- capability registry
- candidate discovery and selection
- normalized CapabilityResult
- timeout, retry and fallback contracts
- observability events
- source/tool metadata propagation

## Acceptance criteria
- Semantic interpretation and execution authorization remain separate.
- Every executable capability declares its action and safety requirements.
- No capability can bypass Action Gate.
