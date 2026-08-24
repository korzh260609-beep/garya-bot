# SG 2.1 ROADMAP — BLOCK 5: CAPABILITY SYSTEM

## Goal
Provide a registry and normalized execution contract for replaceable SG abilities.

## Deliverables
- Capability contract
- capability registry
- candidate discovery and selection
- normalized CapabilityResult
- timeout, retry and fallback contracts
- source/tool metadata propagation

## Acceptance criteria
- Capabilities exist independently from commands and transports.
- Every executable capability declares action and safety requirements.
- Capability failures and partial results remain visible.
