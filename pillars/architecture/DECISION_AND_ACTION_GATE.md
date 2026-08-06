# SG 2.1 — DECISION AND ACTION GATE

## Separation of responsibility
The Semantic Kernel decides what the request means and proposes a safe next step. The Action Gate decides whether the selected action may execute.

## Action classes
- read-only
- analysis-only
- prepare-only
- state-changing
- external-action
- private-data
- expensive-costly

## ActionRequest
- capability
- action_type
- actor
- scope
- payload
- sources
- risk
- cost
- confirmation_required
- idempotency_key

## Gate checks
1. identity
2. role and permission
3. data and project scope
4. source/tool availability
5. risk policy
6. cost policy
7. confirmation
8. idempotency
9. audit requirements

## Hard rules
- The gate does not interpret meaning.
- Analysis and explanation are not blocked merely because execution is forbidden.
- A blocked action may become a safe explanation, simulation or prepare-only result.
- No protected action executes through a transport, model or tool bypass.
