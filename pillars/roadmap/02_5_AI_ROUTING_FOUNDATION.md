# SG 2.1 ROADMAP — BLOCK 2.5: AI ROUTING FOUNDATION

## Status
Implementation complete on `dev/sg2.1-semantic`. Exit gate is satisfied only when CI is green for the final Block 2.5 commit.

## Goal
Connect the first production reasoning model through a replaceable, observable and cost-controlled AI routing layer before Decision Engine development begins.

## Deliverables
- [x] AI Provider contract
- [x] AI Router contract and implementation
- [x] model registry and environment configuration
- [x] reasoning-model selection policy
- [x] specialized-first routing policy
- [x] provider timeout, retry and fallback behavior
- [x] normalized AI result and error contracts
- [x] structured-output validation
- [x] production `MeaningInterpreter` adapter
- [x] token, latency, reason and cost metadata
- [x] trace propagation for every model call
- [x] secret-safe environment configuration
- [x] contract, provider, failure and integration tests

## Implemented runtime path
`CanonicalInput → ProductionMeaningInterpreter → AIRouter → ModelRegistry → AIProvider → validated SemanticInterpretation → SemanticKernel`

Direct provider access is not exposed as a supported Semantic Kernel integration path.

## Failure behavior
- Missing credentials: explicit `AI_CONFIGURATION_ERROR`.
- Timeout: hard router timeout with provider cancellation request.
- Retry: bounded and only for retryable failures.
- Fallback: optional, bounded and observable.
- Invalid JSON or invalid semantic contract: fail closed.
- Provider HTTP and network failures: normalized error codes without secrets.

## Observability
Every routed call carries:
- trace ID and request ID
- provider and model
- routing reason
- attempt count and fallback marker
- latency
- token usage when returned by the provider
- estimated cost when model pricing is configured

Prompt content, API keys and authorization headers are excluded from telemetry.

## Hard rules
- SG modules cannot call an AI provider directly.
- Every AI call passes through AI Router.
- The model provides reasoning but cannot bypass SG contracts or execute protected actions.
- Provider replacement must not change Semantic Kernel contracts.
- API keys and provider secrets are never committed or logged.
- Invalid or incomplete model output fails closed.

## Acceptance criteria
- [x] Semantic Kernel works through the production MeaningInterpreter adapter.
- [x] Model responses are validated before entering SG contracts.
- [x] Missing credentials, timeout, invalid output and provider failure are handled explicitly.
- [x] Retry and fallback behavior are bounded and observable.
- [x] Every call records model, provider, reason, trace identifiers, latency, usage and cost metadata when available.
- [x] Tests prove that direct provider bypass is not part of the supported architecture.

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
