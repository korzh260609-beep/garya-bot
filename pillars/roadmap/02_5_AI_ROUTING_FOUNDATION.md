# SG 2.1 ROADMAP — BLOCK 2.5: AI ROUTING FOUNDATION

## Goal
Connect the first production reasoning model through a replaceable, observable and cost-controlled AI routing layer before Decision Engine development begins.

## Deliverables
- AI Provider contract
- AI Router contract and implementation
- model registry and configuration
- reasoning-model selection policy
- specialized-first routing policy
- provider timeout, retry and fallback behavior
- normalized AI result and error contracts
- structured-output validation
- production `MeaningInterpreter` adapter
- token, latency, reason and cost metadata
- trace propagation for every model call
- secret-safe environment configuration
- contract, failure and integration tests

## Hard rules
- SG modules cannot call an AI provider directly.
- Every AI call passes through AI Router.
- The model provides reasoning but cannot bypass SG contracts or execute protected actions.
- Provider replacement must not change Semantic Kernel contracts.
- API keys and provider secrets are never committed or logged.
- Invalid or incomplete model output fails closed.

## Acceptance criteria
- Semantic Kernel works through the production MeaningInterpreter adapter.
- Model responses are validated before entering SG contracts.
- Missing credentials, timeout, invalid output and provider failure are handled explicitly.
- Retry and fallback behavior are bounded and observable.
- Every call records model, provider, reason, trace identifiers, latency, usage and cost metadata when available.
- Tests prove that direct provider bypass is not part of the supported architecture.

## Boundaries
- No Decision Engine logic.
- No Action Gate implementation.
- No Telegram, Discord or Web transport.
- No protected action execution.
- No domain-specific AI prompts or agents.

## Entry gate
Blocks 0, 1 and 2 must have successful CI evidence.

## Exit gate
Block 3 may begin only after the production reasoning path works through AI Router and all acceptance tests pass in CI.
