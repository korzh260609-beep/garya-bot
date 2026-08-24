# SG 2.1 ROADMAP — BLOCK 2.5: AI ROUTING FOUNDATION

## Status
Implementation complete on `dev/sg2.1-semantic`. Exit gate is satisfied only when CI is green for the final Block 2.5 commit.

Adaptive AI Routing 2.0 (AR2) is an **accepted extension with implementation in progress** over this completed foundation. AR2.1–AR2.9 are implemented, exact-HEAD CI-verified and closed; AR2.10 has local implementation evidence and remains NOT CLOSED until exact-HEAD CI succeeds.

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

## Adaptive AI Routing 2.0 (AR2) — accepted planned extension

### Purpose
AR2 extends the existing AI Router rather than creating a second router. Its goal is to use the **minimum sufficient intelligence** for each task while preserving correctness, security, evidence boundaries and transport independence.

### Canonical tiers
- **L0 — deterministic / no LLM.** Exact commands, task/schedule list and lookup, exact DB/source/GitHub retrieval, deterministic memory retrieval and other operations that existing SG code can answer correctly without model reasoning.
- **L1 — low-cost AI.** Intent refinement, language detection, extraction, classification, simple normalization, lightweight ranking and short structured transforms.
- **L2 — general AI.** Ordinary conversation, memory synthesis, multi-source summarization, standard planning/research and typical response composition.
- **L3 — advanced reasoning.** Difficult debugging, architecture, complex coding, conflict-heavy analysis, deep multi-step reasoning and other tasks whose reliability requires the strongest configured reasoning tier.

Concrete provider/model names are configuration, not business logic. The registry exposes tiers/capabilities/specialties; environment/configuration binds those tiers to current provider models. Replacing Luna/Terra/Sol or adding Claude/DeepSeek/local models must not require Semantic Kernel or domain-logic changes.

### Routing flow
`Canonical request → semantic/capability resolution → deterministic-vs-AI gate → task assessment → tier selection → specialty/capability match → reasoning-effort selection → existing AIRouter/provider call → usage accounting → validation → bounded semantic escalation if required → result`

### Task assessment signals
AR2 may deterministically evaluate bounded signals including:
- task class;
- complexity;
- reasoning depth;
- risk;
- ambiguity;
- tool depth;
- context pressure/size;
- code/debugging requirements;
- number/conflict level of evidence sources.

Task assessment should use existing semantic/capability/runtime facts first. A model must not be invoked merely to decide whether a deterministic executor already exists.

### Tier policy
A weighted score may guide L1/L2/L3 selection, but hard constraints dominate. Examples:
- exact operational lookup/listing with a known executor → L0;
- classification/extraction/semantic normalization → normally L1;
- ordinary synthesis/conversation → normally L2;
- difficult architecture/debugging/reasoning → minimum L3.

Request length alone is never sufficient reason to select L3. Presence of words such as `GitHub`, `memory`, `task` or `automation` is never sufficient reason either.

### Reasoning effort
Model selection and reasoning effort are independent controls. AR2 selects the lowest sufficient reasoning effort supported by the chosen model. Typical policy:
- L1 classification/extraction → none/low;
- L2 ordinary work → low, medium only when justified;
- L3 difficult work → medium/high;
- xhigh/max only for exceptional tasks with explicit routing justification.

### Fallback vs escalation
These are different mechanisms and MUST remain separate:
- **fallback** handles technical/provider failure such as network error, timeout, retryable HTTP error or unavailable primary model;
- **semantic escalation** handles a valid model response that fails task-specific validation or is insufficiently reliable for the task.

Escalation is bounded (normally L1→L2 or L2→L3, at most one or two promotions) and cannot loop indefinitely. A model cannot self-authorize a more expensive tier.

### Validation
Validation is deterministic first: schema, required fields, tool/evidence presence, identifiers, contract invariants and task-specific checks. Model-based critique is optional and cannot replace deterministic validation where deterministic truth is available.

### Cost, usage accounting and mutable pricing
Before a paid call SG should reduce avoidable context through authorized retrieval, filtering, deduplication, relevance ranking and bounded context assembly.

AR2.10 must account for AI use at three levels:
- **call-level:** provider/model/tier/reasoning effort plus input, cached input, output, reasoning and other provider-exposed billable units/tokens, fallback/escalation markers and monetary cost;
- **request/task-level:** aggregate every model call belonging to one user request/task, including fallback/escalation, into total token usage and total cost;
- **aggregate-level:** authorized day/week/month views by model/provider/tier/task class/user-role/workspace/project, including tier distribution, escalation rate and cost metrics.

Pricing is deliberately mutable. Exact provider prices, exchange rates, user credit conversion, markups/discounts, budget thresholds and routing weights are configuration/policy and may be corrected over time. They MUST NOT be hard-coded as permanent architectural constants.

The pricing catalog must be versioned/effective-dated. At minimum it should preserve provider/model/billable category/rate/currency/effective-from/effective-to/version/source. A tariff change creates a new pricing version rather than rewriting the old one.

Every completed billable call must retain the pricing version/snapshot used at execution time so historical costs remain reproducible. New pricing MUST NOT silently recalculate old calls. If a historical rate was wrong, correction is represented explicitly as adjustment/reconciliation evidence, preserving original and corrected values.

When providers expose authoritative post-call usage, those units take precedence over pre-call estimates. If authoritative provider billing amounts become available later, SG may reconcile calculated cost against provider-reported cost while preserving both and their provenance.

Technical provider/model usage accounting is canonical evidence. Future commercial charging (AI credits, subscriptions, free allowances, role/workspace budgets, markup/discounts) is a mutable policy layer above that evidence and cannot rewrite underlying historical provider consumption/cost records.

### Security and authority boundaries
AR2 does not own identity, access, resource authority, Action Gate, Owner/Monarch Security, credentials, delivery policy or durable memory truth. Denied/unauthorized paths terminate before paid AI execution where existing architecture requires that. Selected model/tier cannot grant authority, bypass gates or mutate protected state directly.

Usage/cost records remain privacy- and scope-bounded observability/accounting evidence; they do not become identity or authorization truth.

### Transport independence
Telegram, Discord, Web/API, Email, voice and the future native SG interface all use the same routing and usage-accounting policy. Transport may supply bounded metadata but does not choose model tier or pricing truth.

### AR2 implementation sequence
- **AR2.1 — Routing Contract:** IMPLEMENTED / CI-VERIFIED / CLOSED. Adds bounded routing metadata/task-class contract while preserving current AI request compatibility. Evidence: `e9e0d053`, SG 2.1 CI #8643 SUCCESS.
- **AR2.2 — Tier-aware Model Registry:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `26269895`, SG 2.1 CI #8645 SUCCESS.
- **AR2.3 — Deterministic L0 Gate:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `c2f139e0`, SG 2.1 CI #8647 SUCCESS.
- **AR2.4 — Task Assessment:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `c6944dd8`, SG 2.1 CI #8649 SUCCESS.
- **AR2.5 — Tier Selector:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `1c2cb25b`, SG 2.1 CI #8651 SUCCESS.
- **AR2.6 — Specialty + Tier Routing:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `ec47bd3d`, SG 2.1 CI #8653 SUCCESS. Selects enabled models by minimum tier, required capabilities, specialty, priority and configured cost; preferred models and provider fallback cannot bypass tier/capability requirements.
- **AR2.7 — Reasoning Effort Selector:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `aeb3bb52`, SG 2.1 CI #8655 SUCCESS. Selects the minimum sufficient bounded effort independently from model tier, verifies selected/fallback model support, propagates it through existing provider metadata, and permits `xhigh`/`max` only through explicit trusted SG policy.
- **AR2.8 — Validation:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `1a208312`, SG 2.1 CI #8657 SUCCESS. Performs deterministic structured/schema, required-field, identifier, evidence, contract-invariant and task-specific validation; exposes an explicit bounded confidence contract; records privacy-safe validation telemetry; and keeps semantic insufficiency distinct from provider fallback.
- **AR2.9 — Semantic Escalation:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `1f45f80d`, SG 2.1 CI #8659 SUCCESS. Bounded L1→L2→L3 promotion remains distinct from technical provider fallback, preserves the original request, bounded prior result and validation evidence, respects the trusted maximum tier, stops after at most two promotions and fails visibly when a higher tier is unavailable.
- **AR2.10 — Cost Intelligence, Usage Accounting & Observability:** IMPLEMENTED / CI-VERIFIED / CLOSED. Evidence: `c0255eed`, SG 2.1 CI #8661 SUCCESS. Adds call/request/aggregate usage and cost evidence, cached-input/reasoning token capture, versioned effective-dated pricing with immutable per-call snapshots, provider-reported cost precedence, reconciliation evidence and privacy-safe tier/effort/fallback/escalation telemetry.
- **AR2.10 production reconciliation extension:** IMPLEMENTED LOCALLY / NOT CI-VERIFIED / NOT LIVE-VERIFIED. Persists call evidence and authoritative OpenAI Organization Costs buckets in PostgreSQL, retrieves Costs plus completions Usage with the separate `OPENAI_ADMIN_API_KEY`, runs bounded daily reconciliation over a settled lookback window, preserves estimate/actual/difference, rejects invalid schemas instead of recording false zero cost, and explicitly limits provider actual attribution to the aggregate dimensions supplied by OpenAI.

### Implementation discipline
Each AR2.x stage follows existing SG development protocol:
`scope/contracts → minimal implementation → tests → regression/security checks → npm run check → exact-HEAD SG 2.1 CI → evidence → next stage`.

No AR2 stage is CLOSED from documentation alone. Existing `src/ai/router.js`, `modelRegistry.js`, `productionPolicy.js`, provider contracts, Action Gate and Semantic Kernel boundaries are extended/reused, not duplicated.

## Entry gate
Blocks 0, 1 and 2 must have successful CI evidence.

## Exit gate
Block 3 may begin only after the production reasoning path works through AI Router and all acceptance tests pass in CI.

For AR2, implementation may begin only from the accepted specification above and every AR2.x stage must remain NOT CLOSED until exact-head code/test/CI evidence exists.
