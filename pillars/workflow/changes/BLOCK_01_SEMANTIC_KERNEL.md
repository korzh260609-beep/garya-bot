# CHANGE SPECIFICATION — BLOCK 1: SEMANTIC KERNEL

## Scope
Implement the transport-independent semantic pipeline defined by `pillars/roadmap/01_SEMANTIC_KERNEL.md`.

## Allowed changes
- `src/semantic/*`
- `src/contracts/semantic.js`
- `src/index.js`
- `tests/semantic-kernel.test.js`
- `package.json`
- root `README.md`

## Required contracts
- CanonicalInput
- SemanticInterpretation
- ContextNeeds
- EvidenceNeeds
- CandidateAction
- DecisionEnvelope
- ResponsePlan
- MeaningInterpreter

## Vertical slice
Canonical input → injected meaning interpreter → validated semantic interpretation → DecisionEnvelope → safe no-op execution → response composition.

## Boundaries
- no keyword, phrase, regex or command routing for meaning
- no database, durable memory, transport or external tool calls
- no protected action execution
- no production AI-provider integration
- at most one clarification question

## Acceptance
- all semantic contracts fail closed
- equivalent interpretations produce compatible envelopes
- missing essential data produces one clarification
- external action candidates are prepare-only in Block 1
- diagnostics preserve trace identifiers without private raw-data logging
- `npm test` and `npm run check` pass in CI
