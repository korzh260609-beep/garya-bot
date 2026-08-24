# SG 2.1 — ADAPTIVE AI ROUTING 2.0 (AR2)

## Status
ACCEPTED ARCHITECTURE / AR2.1–AR2.10 CI-VERIFIED / PRODUCTION COST RECONCILIATION EXTENSION IN PROGRESS.

Current implementation evidence:
- AR2.1 Routing Contract is IMPLEMENTED / CI-VERIFIED / CLOSED at `e9e0d053d6243ebf8752059c4c8f3c761a8c859b`, SG 2.1 CI #8643 SUCCESS;
- AR2.2 Tier-aware Model Registry is IMPLEMENTED / CI-VERIFIED / CLOSED at `26269895369e7164fb3154ad4348075420af3f60`, SG 2.1 CI #8645 SUCCESS;
- AR2.3 Deterministic L0 Gate is IMPLEMENTED / CI-VERIFIED / CLOSED at `c2f139e008962a19eea9aba68efe9b1bedc2c606`, SG 2.1 CI #8647 SUCCESS;
- AR2.4 Task Assessment is IMPLEMENTED / CI-VERIFIED / CLOSED at `c6944dd8e06c5503350a5bcd1a2c27a282d1cacb`, SG 2.1 CI #8649 SUCCESS;
- AR2.5 Tier Selector is IMPLEMENTED / CI-VERIFIED / CLOSED at `1c2cb25ba75f889c289f49a694f1849ce653f81c`, SG 2.1 CI #8651 SUCCESS;
- AR2.6 Specialty + Tier Routing is IMPLEMENTED / CI-VERIFIED / CLOSED at `ec47bd3d469ceaae6d317a589fdcef45103d21ed`, SG 2.1 CI #8653 SUCCESS;
- AR2.7 Reasoning Effort Selector is IMPLEMENTED / CI-VERIFIED / CLOSED at `aeb3bb52e3ad7e42ac3a00fb70d3af30f1e18049`, SG 2.1 CI #8655 SUCCESS;
- AR2.8 Validation is IMPLEMENTED / CI-VERIFIED / CLOSED at `1a208312435c6b5f6fa9296c1808f418010c9697`, SG 2.1 CI #8657 SUCCESS;
- AR2.9 Semantic Escalation is implemented locally in the existing `AIRouter` result boundary;
- legacy AI request callers receive compatible defaults;
- contradictory or unbounded routing metadata fails closed;
- AR2.6 filters enabled models by minimum required tier and required capabilities, prefers exact specialty over generic reasoning, then chooses the lowest sufficient tier before priority and configured cost;
- a higher tier may safely satisfy a lower requirement when no lower eligible model exists, while a lower tier can never satisfy a higher requirement;
- preferred model configuration cannot bypass tier/capability requirements;
- provider fallback preserves the original tier and capability requirements and remains distinct from semantic escalation;
- selected provider model and actual tier are recorded without hard-coded product names;
- AR2.7 selects the minimum sufficient effort independently from the model tier, verifies model support, preserves the required floor across provider fallback and reserves `xhigh`/`max` for explicit `trusted-sg-policy` constraints;
- AR2.8 validates structured/schema contracts, required fields, identifier preservation, evidence presence, task-specific invariants and explicit confidence thresholds deterministically first;
- validation failures return bounded evidence for AR2.9 and never masquerade as technical provider fallback;
- AR2.9 performs bounded L1→L2→L3 promotion only after deterministic validation failure, preserves original request/evidence plus bounded prior-result handoff, respects trusted maximum tier, and remains distinct from technical fallback;
- AR2.9 targeted tests and `npm run check` pass locally (1173 tests, 1098 passed, 75 skipped, 0 failed);
- AR2.9 Semantic Escalation is IMPLEMENTED / CI-VERIFIED / CLOSED at `1f45f80d0c100db96c5f3b72ef1b19ca115470da`, SG 2.1 CI #8659 SUCCESS;
- AR2.10 Cost Intelligence, Usage Accounting & Observability is IMPLEMENTED / CI-VERIFIED / CLOSED at `c0255eed08b650462bc2499174f618fb2e9529a9`, SG 2.1 CI #8661 SUCCESS;
- the production reconciliation extension is implemented locally and remains NOT CI-VERIFIED / NOT LIVE-VERIFIED until its exact-HEAD CI and deployment evidence exist.

This document defines the canonical architecture for the Adaptive AI Routing 2.0 extension of the existing SG 2.1 AI Routing Foundation. Documentation alone does not prove implementation, CI verification, deployment or live operation.

## 1. Purpose
AR2 selects the minimum sufficient model intelligence and reasoning effort for each AI-requiring task while preserving correctness, security, cost controls, observability and transport independence.

AR2 is an additive evolution of the existing `AIRouter`, `ModelRegistry`, `productionPolicy` and provider contracts. It MUST NOT create a second independent AI router, provider bypass or parallel authorization stack.

## 2. Core principle — Minimum Sufficient Intelligence
SG should use the least expensive/least intensive execution path that can reliably complete the task.

This means:
- deterministic code is preferred when it can answer exactly and safely;
- cheap AI is preferred for bounded extraction/classification;
- general AI is used for ordinary synthesis/reasoning;
- the strongest reasoning tier is used only when task evidence requires it;
- price never overrides the minimum reliability requirement.

Request length, transport, user phrasing or presence of words such as `GitHub`, `memory`, `task` or `automation` cannot alone force an expensive tier.

## 3. Canonical tiers

### L0 — deterministic / no LLM
Used when an existing SG executor can answer correctly without model reasoning.
Examples include exact task/schedule retrieval, exact DB/source lookup, deterministic memory retrieval, GitHub HEAD/branch/CI lookup and known contract execution.

L0 is not a model tier. It is the no-AI gate outcome.

### L1 — low-cost AI
For bounded high-volume tasks such as:
- language detection;
- semantic intent refinement;
- classification;
- entity/date/parameter extraction;
- normalization;
- short structured transforms;
- lightweight ranking.

### L2 — general AI
For:
- ordinary conversation;
- memory synthesis;
- multi-source summarization;
- standard planning/research;
- ordinary response composition;
- moderate code/document analysis.

### L3 — advanced reasoning
For tasks whose reliability requires deeper reasoning, such as:
- difficult CI/root-cause debugging;
- architecture design;
- complex coding/refactoring analysis;
- conflict-heavy historical reconstruction;
- deep multi-step reasoning.

## 4. Provider/model independence
Business logic MUST refer to capabilities, specialties, tiers and policy, not hard-coded product names.

Concrete provider models are configuration. Current or future OpenAI Luna/Terra/Sol, Claude, DeepSeek or local models may be bound to L1/L2/L3 without changing Semantic Kernel/domain contracts.

A model registry entry may expose:
- id;
- provider;
- provider model name;
- tier;
- specialties;
- capabilities;
- supported reasoning efforts;
- default reasoning effort;
- pricing metadata reference;
- fallback id;
- enabled/priority state.

## 5. Runtime flow

```text
Canonical Request
→ Semantic/Capability Resolution
→ Deterministic-vs-AI Gate
   ├─ deterministic executor exists → L0 execution
   └─ AI required
      → Task Assessment
      → Tier Selector
      → Specialty + Capability Match
      → Reasoning Effort Selector
      → existing AIRouter
      → existing production policy / provider boundary
      → Usage Accounting
      → Validation
      → bounded Semantic Escalation if required
      → Result
```

The router does not replace Semantic Kernel, Decision Engine, Action Gate, Access Control, Resource Authority, Owner Security, Memory or Capability System.

## 6. Deterministic-vs-AI Gate
Before a paid AI call, SG asks whether an existing deterministic executor can satisfy the request.

The gate uses actual resolved task/capability/executor facts. It MUST NOT use phrase/keyword imitation of intelligence and MUST NOT invoke an LLM merely to discover an already-known deterministic path.

Known task-store, schedule-store, DB/source and exact provider lookups should remain L0 whenever reasoning is unnecessary.

## 7. Task Assessment
Task Assessment is primarily deterministic and may use bounded runtime facts:
- task class;
- complexity;
- reasoning depth;
- risk;
- ambiguity;
- tool depth;
- context pressure/size;
- number of evidence sources;
- evidence conflicts;
- coding/debugging requirements.

A normalized assessment may be represented as values in `[0,1]`, but exact weights are policy/configuration, not permanent architecture truth.

AI-assisted assessment is allowed only when deterministic evidence is insufficient and must itself use the lowest sufficient tier.

## 8. Tier Selector
Tier selection combines assessment and hard policy constraints.

A weighted score may guide selection, but hard rules dominate:
- deterministic exact work → L0;
- extraction/classification/normalization → normally L1;
- ordinary synthesis/conversation → normally L2;
- difficult architecture/debugging/deep reasoning → minimum L3.

Requests may also define `minimumTier` / `maximumTier` constraints from trusted SG policy. User/model text cannot broaden those constraints.

## 9. Specialty + Tier Selection
The existing model registry evolves from specialty-only selection toward:

```text
required tier
+ specialty/capability support
+ enabled state
+ policy
+ availability
+ cost
+ priority
```

The selector chooses the lowest eligible tier/model that satisfies the task contract.

## 10. Reasoning Effort Selector
Model tier and reasoning effort are independent controls.

Typical policy:
- L1 classification/extraction → none/low;
- L2 ordinary work → low;
- L2 difficult synthesis → medium;
- L3 debugging/architecture → medium/high;
- xhigh/max → exceptional, explicitly justified tasks only.

The existing provider metadata path for `reasoningEffort` is reused rather than duplicated.

## 11. Validation
Validation is deterministic first.

Examples:
- JSON/schema validity;
- required fields;
- identifier preservation;
- tool/evidence presence;
- contract invariants;
- task-specific deterministic checks;
- confidence threshold where a validated semantic contract supports it.

Model-based critique is optional and cannot replace deterministic truth where deterministic truth exists.

## 12. Fallback is not escalation
These mechanisms are architecturally distinct.

### Provider fallback
Used when the primary call fails technically:
- network failure;
- timeout;
- retryable provider error;
- unavailable provider/model.

It preserves the same task/tier intent as far as possible.

### Semantic escalation
Used when a model returns a technically valid response but the result is insufficient for the task according to validation/confidence policy.

Typical promotions:
- L1 → L2;
- L2 → L3.

Escalation is bounded to prevent loops and uncontrolled cost. A model cannot self-authorize escalation.

Escalation handoff should preserve:
- original user request;
- bounded resolved context;
- retrieved/tool evidence;
- previous result;
- validation failure/confidence;
- explicit escalation reason.

## 13. Cost, usage accounting and context intelligence
AR2 extends existing cost policy; it does not replace it.

Before expensive calls SG should minimize avoidable tokens through authorized:
- retrieval;
- filtering;
- deduplication;
- relevance ranking;
- bounded context assembly.

Cost limits may deny or constrain work according to canonical policy, but cost optimization MUST NOT silently route below the minimum reliable tier.

### 13.1 Call-level usage record
Every provider/model call should record, when available:
- request/trace identifier;
- task class and routing reason;
- provider;
- exact provider model identifier;
- logical tier `L1/L2/L3`;
- reasoning effort;
- input tokens;
- cached input tokens;
- output tokens;
- reasoning tokens when the provider exposes them separately;
- other billable token/unit categories exposed by the provider;
- estimated cost before execution where available;
- actual/calculated cost after execution;
- currency;
- pricing policy/catalog version used for calculation;
- fallback marker;
- escalation source/reason;
- actor/global user/workspace/project scope identifiers only where authorized and privacy-bounded.

Unavailable provider usage fields remain explicit `unknown/null`; SG MUST NOT invent exact token counts.

### 13.2 Request-level usage record
One user request/task may produce multiple AI calls because of semantic interpretation, retrieval synthesis, fallback or escalation. SG should aggregate those calls into one request/task usage record containing:
- total input/cached/output/reasoning tokens where available;
- total model-call count;
- calls by tier/model/provider;
- fallback/escalation count;
- total estimated/actual monetary cost;
- start/end timestamps and trace linkage;
- task class/capability.

This makes it possible to answer “how much did this complete task cost?” rather than exposing only isolated model calls.

### 13.3 Aggregate usage views
Authorized reporting should support bounded aggregation by day/week/month and by dimensions such as:
- model/provider;
- L1/L2/L3 tier;
- task class/capability;
- user/role/workspace/project where policy permits;
- input/output/cached/reasoning token category;
- fallback/escalation;
- total monetary cost;
- average/median cost per request/task;
- tier distribution;
- L1→L2 and L2→L3 escalation rates;
- cached-token savings when provider data permits reliable calculation.

Aggregate metrics must derive from persisted call/request evidence, not model-generated estimates presented as exact accounting.

### 13.4 Mutable pricing catalog
Provider pricing is operational configuration and WILL change over time. Therefore exact model prices, exchange rates, markups, user-facing credit conversion, budget thresholds and routing-score weights are **not permanent architecture constants**.

The pricing catalog/configuration should support at least:
- provider;
- model identifier;
- billable unit/category;
- price per unit/million tokens as applicable;
- currency;
- effective-from timestamp;
- optional effective-to timestamp;
- pricing catalog/version identifier;
- source/provenance of the configured rate;
- enabled/disabled state.

Changing a tariff creates a new effective pricing version; it MUST NOT rewrite the historical tariff snapshot used by already-completed calls.

### 13.5 Historical accounting immutability
For every completed billable call SG must retain enough pricing evidence to reproduce the cost that was calculated at execution time. Historical reports therefore use the rate/version effective for that call, not the newest current price.

A later price correction may create an explicit adjustment/recalculation record, but must not silently mutate historical accounting. Reports should distinguish original charged/calculated cost from later corrected/normalized cost when both exist.

### 13.6 Estimated cost vs provider actuals
When the provider exposes authoritative usage/billing units after a call, post-call accounting should prefer those units. Pre-call estimates remain marked as estimates.

OpenAI organization `Usage` and `Costs` Admin API responses are the authoritative post-settlement source for aggregate provider spend. SG automatically retrieves them with `OPENAI_ADMIN_API_KEY`, persists immutable provider buckets and reconciliation runs, and compares them with locally persisted call estimates. A missing/invalid provider response must fail visibly and must never be interpreted as zero cost.

Provider Costs data is aggregate by time/project/API-key/line-item dimensions. It does not prove an exact monetary amount for one individual request unless the provider supplies that attribution. SG therefore labels this evidence `aggregate-window` and does not invent exact per-call actuals by dividing or guessing. Per-call cost remains `estimated`, `provider-reported`, `reconciled` only when direct evidence exists, or `unpriced` when no verified tariff exists.

Production persistence uses `ai_cost_calls`, `ai_provider_cost_buckets` and `ai_cost_reconciliation_runs`. Reconciliation runs daily by default, rechecks a settled lookback window and preserves both provider actual, local estimate and difference.

### 13.7 User-facing billing is a separate policy layer
AR2 usage accounting supplies verified technical consumption. It does not permanently define how SG charges users.

Future user-facing pricing may add:
- AI credits;
- free allowances;
- subscription quotas;
- role-specific limits;
- markup/discount coefficients;
- workspace/project budgets;
- warning/block thresholds.

Those commercial rules are mutable configuration/policy layered over technical usage accounting. Changing user tariffs must not change the recorded provider/model consumption or historical provider-cost evidence.

## 14. Security and authority
AR2 cannot:
- grant identity/roles/access;
- broaden resource authority;
- bypass Action Gate;
- weaken Owner/Monarch Security;
- expose credentials/secrets;
- mutate protected state directly;
- convert model confidence into authorization.

Where Access Control or other policy denies AI entitlement/budget, the path terminates before paid model execution.

Usage/cost records are observability/accounting data and must respect privacy/scope isolation. They cannot become a new identity, authority or memory-truth source.

## 15. Transport independence
Telegram, Discord, Web/API, Email, voice and the future native SG interface are clients of the same AR2 policy.

Transport metadata may be bounded input facts but transport never owns tier/model selection or pricing truth.

## 16. Memory routing examples
- exact scoped memory retrieval → L0;
- semantic query normalization → L1;
- ordinary memory synthesis → L2;
- conflicting provenance/supersession/timeline reconstruction → L2 or L3 according to assessment.

Historical & Semantic Memory Search does not automatically imply L3.

## 17. GitHub routing examples
- branch/HEAD/CI/file lookup → L0;
- diff summary → L1/L2;
- ordinary code review → L2;
- difficult root-cause debugging → L3;
- architecture/refactoring design → L3.

GitHub access itself does not imply a strong model.

## 18. Observability
AR2 extends existing AI telemetry with bounded fields such as:
- task class;
- tier;
- routing score/assessment;
- complexity/risk/ambiguity/reasoning depth;
- reasoning effort;
- routing reason;
- minimum/maximum tier;
- validation outcome;
- escalation source/reason;
- provider fallback separately;
- per-call token categories;
- pricing catalog/version;
- estimated/actual/calculated/reconciled cost and currency.

Operational metrics should include tier distribution, token/cost distribution and escalation rate. A high L1→L2 escalation rate indicates a poor routing policy and should lead to policy tuning, not hidden repeated calls.

## 19. Implementation stages
- AR2.1 Routing Contract — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8643)
- AR2.2 Tier-aware Model Registry — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8645)
- AR2.3 Deterministic L0 Gate — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8647)
- AR2.4 Task Assessment — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8649)
- AR2.5 Tier Selector — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8651)
- AR2.6 Specialty + Tier Routing — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8653)
- AR2.7 Reasoning Effort Selector — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8655)
- AR2.8 Validation — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8657)
- AR2.9 Semantic Escalation — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8659)
- AR2.10 Cost Intelligence, Usage Accounting & Observability — IMPLEMENTED / CI-VERIFIED / CLOSED (SG 2.1 CI #8661)
- AR2.10 production Costs/Usage reconciliation extension — IMPLEMENTED LOCALLY / NOT CI-VERIFIED / NOT LIVE-VERIFIED

AR2.10 includes call-level, request-level and aggregate token/cost accounting, mutable/versioned pricing, historical pricing immutability and reconciliation-ready provider cost evidence. Its production extension adds PostgreSQL call/bucket/run persistence, automatic OpenAI Organization Costs/Usage retrieval, aggregate reconciliation and fail-visible stale/error semantics. `OPENAI_ADMIN_API_KEY` is secret deployment configuration; it is never telemetry or application data. User-facing commercial billing/credits may be layered later without changing AR2 technical usage truth.

Each stage requires implementation, tests/regressions, `npm run check`, exact-HEAD SG 2.1 CI evidence and documentation synchronization before closure.

## 20. Non-negotiable boundaries
- one AI Router only;
- no direct provider bypass;
- no second authorization/security stack;
- no hard-coded provider product names or permanent tariff numbers in business logic;
- no retroactive silent rewriting of historical model-call cost when pricing changes;
- no user/model self-selection of a more expensive tier;
- no semantic escalation loops;
- no documentation-only closure;
- existing Block 2.5 fallback/retry/timeout/policy/telemetry semantics remain valid and are extended, not discarded.

## Canonical relationships
- Foundation/implementation program: `../roadmap/02_5_AI_ROUTING_FOUNDATION.md`
- AI model principle: `../AI_MODEL_PRINCIPLE.md`
- Transport boundary: `TRANSPORTS_AND_AI_ROUTING.md`
- Current lifecycle truth: `../roadmap/CURRENT_STATUS.md`
