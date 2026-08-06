# SG 2.1 ROADMAP — BLOCK 3: DECISION ENGINE

## Status
Implementation complete on `dev/sg2.1-semantic`. Exit gate is satisfied only when CI is green for the final Block 3 commit.

## Goal
Turn semantic interpretation and context into a structured, explainable next-step decision without authorizing protected execution.

## Deliverables
- [x] candidate-action evaluation
- [x] deterministic candidate prioritization
- [x] uncertainty handling
- [x] evidence-needs handling
- [x] selected action and response plan
- [x] decision rationale metadata
- [x] DecisionEnvelope validation
- [x] Semantic Kernel integration through an injected Decision Engine
- [x] contract, boundary and compatibility tests

## Implemented runtime path
`CanonicalInput → MeaningInterpreter → SemanticInterpretation → DecisionEngine → DecisionEnvelope + ResponsePlan`

## Decision classes
- `answer`: safe analysis or response composition.
- `clarification`: essential information is missing, or bounded uncertainty requires a question.
- `prepare`: executable, external, state-changing or explicitly prepare-only intent.

Executable intent is represented but never authorized or executed in Block 3.

## Deterministic selection
Candidate actions are evaluated by explicit numeric priority. Higher priority wins; equal priorities preserve original candidate order. When no candidate is supplied, the engine uses the safe analysis-only `compose-answer` default.

## Evidence and uncertainty
Evidence needs remain explicit in `DecisionEnvelope` diagnostics and are not fetched by the engine. Uncertainty can produce clarification only when a clarification question exists; invalid incomplete clarification data fails closed.

## Observability
Decision diagnostics include:
- engine and interpreter identifiers
- uncertainty and configured threshold
- candidate count, selected index and selected priority
- evidence-needed marker
- executable/protected-intent markers
- explicit `permissionChecked: false`
- explicit `capabilityExecuted: false`

## Hard boundaries
- No permission checks.
- No capability execution.
- No Action Gate behavior.
- No transport logic.
- No provider calls from Decision Engine.
- No protected state changes.

## Acceptance criteria
- [x] The engine distinguishes answer, clarification, preparation and executable intent.
- [x] It does not check permissions or execute capabilities.
- [x] Equivalent semantic inputs produce compatible decisions.
- [x] Semantic Kernel behavior remains compatible while decision logic is owned by Decision Engine.

## Exit gate
Block 4 may begin only after all Block 3 checks pass in CI.
