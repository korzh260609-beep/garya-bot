# Block 15 — Production AI Integration

## Status

Completed.

## Goal

Enable controlled production-model execution through the existing AI Router without transferring decisions, authorization or capability execution to an AI provider.

## Implemented

- production OpenAI Responses API composition through `createProductionAI`;
- specialized-first model registry with bounded configured fallback;
- mandatory AI Router boundary for production meaning interpretation;
- strict structured JSON schema output and semantic-contract validation;
- hard timeout, bounded retry and fallback policy;
- emergency AI disable switch that overrides normal enablement;
- explicit per-request reason requirement;
- provider, model, reason, role, latency, usage and cost telemetry;
- pre-call estimated-cost enforcement by role;
- post-call actual-cost enforcement by role;
- bounded model output token configuration;
- sensitive-context rejection before provider execution;
- prompt-injection defensive system boundary;
- deterministic fail-closed semantic fallback;
- production runtime composition only when `SG_AI_ENABLED=true`;
- deterministic non-AI runtime remains the default;
- deployment-secret-only API key configuration.

## Environment controls

- `SG_AI_ENABLED`
- `SG_AI_EMERGENCY_DISABLED`
- `SG_AI_REJECT_SENSITIVE_CONTEXT`
- `SG_AI_MAX_INPUT_CHARACTERS`
- `SG_AI_MAX_OUTPUT_TOKENS`
- `SG_AI_GUEST_MAX_COST_USD`
- `SG_AI_CITIZEN_MAX_COST_USD`
- `SG_AI_MONARCH_MAX_COST_USD`
- `AI_TIMEOUT_MS`
- `AI_MAX_RETRIES`
- `AI_RETRY_DELAY_MS`
- provider model and pricing variables documented in `.env.example`

## Runtime boundary

`ProductionMeaningInterpreter → AIRouter → ProductionAiPolicy → ModelRegistry → AIProvider`

The AI provider only returns a proposed structured semantic interpretation. The deterministic Decision Engine remains the decision owner. Protected actions still require Action Gate authorization and capability execution.

## Failure behavior

- disabled or emergency-disabled AI never calls a provider;
- policy failures do not trigger fallback providers;
- sensitive context is rejected before network execution;
- invalid structured output cannot enter semantic contracts;
- timeout and provider failures remain observable;
- the production interpreter emits an analysis-only deterministic fallback;
- fallback never authorizes or executes a protected action.

## Acceptance evidence

Automated tests cover:

- emergency disable and zero provider calls;
- role-based estimated and actual cost enforcement;
- sensitive-context rejection;
- no policy-to-fallback bypass;
- required telemetry fields without prompt content;
- defensive prompt boundary and unchanged canonical user text;
- invalid-output fail-closed behavior;
- deterministic analysis-only AI failure fallback;
- explicit production composition with deterministic default mode;
- existing retry, timeout, provider, structured output and Semantic Kernel integration tests.

CI executes:

- `npm ci`;
- `npm run migrate`;
- `npm run check`;
- `npm start`;
- `npm run start:worker`.

## Acceptance criteria result

- No production model call bypasses AI Router: satisfied for the active SG 2.1 production composition.
- Every model call records provider, model, reason, latency, usage and estimated cost: satisfied.
- Invalid model output cannot enter semantic contracts: satisfied.
- AI failure does not authorize or execute an action: satisfied.
- Cost limits are enforceable by role and configuration: satisfied before and after provider execution.
- Secrets are stored only in deployment secret storage: enforced by configuration design and documentation; no secret value is committed or logged.
