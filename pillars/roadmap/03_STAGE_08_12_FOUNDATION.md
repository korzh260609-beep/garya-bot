# SG 2.1 ROADMAP — BLOCKS 3–4: DECISION, SAFETY AND CAPABILITIES

## Block 3 — Decision and Safety

### Deliverables
- action classification
- identity and actor model
- permission model
- scope model
- risk policy
- cost policy
- confirmation policy
- idempotency contract
- ActionRequest and GateResult
- audit trail
- safe degradation to analysis, simulation or prepare-only output

### Acceptance criteria
SG may reason freely, but every protected execution path passes the Action Gate.

## Block 4 — Capability System

### Deliverables
- Capability contract
- CapabilityResult contract
- registry and discovery
- capability selection policy
- source/tool requirements
- timeout, retry and fallback contracts
- result normalization
- capability observability
- initial safe capabilities: no-op, calculation/test fixture, read-only local source

### Gates
- Commands call capabilities; commands do not define capabilities.
- Capability access does not grant governance authority.
- Capability results expose failures, uncertainty and provenance.
- No domain capability bypasses the platform Action Gate.

## Acceptance criteria
The Semantic Kernel can select a capability through contracts, the gate can authorize or block it, and the response layer can explain the normalized result.
