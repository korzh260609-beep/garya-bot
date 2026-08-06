# SG 2.1 — CAPABILITY SYSTEM

## Purpose
Capabilities are replaceable abilities used by SG after semantic interpretation and safety checks.

## Capability contract
Every capability declares:
- name and version
- purpose
- input schema
- output schema
- action class
- required permissions
- source/tool requirements
- risk class
- cost class
- confirmation policy
- timeout and retry policy
- observability events
- fallback behavior

## Execution flow

```text
DecisionEnvelope
→ candidate capability lookup
→ capability selection
→ ActionRequest
→ Action Gate
→ capability execution
→ normalized CapabilityResult
```

## Rules
- Capabilities do not own user conversation or SG identity.
- Commands call capabilities; capabilities are not built around commands.
- Capability results are normalized before reasoning or response composition.
- Tool failures, uncertainty and partial results remain visible.
- Domain capabilities cannot bypass platform gates.
