# SG 2.1 — ADAPTIVE AI ROUTING 2.0 (AR2)

## Status
ACCEPTED ARCHITECTURE / PLANNED / NOT IMPLEMENTED.

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
- pricing metadata;
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

## 13. Cost and context intelligence
AR2 extends existing cost policy; it does not replace it.

Before expensive calls SG should minimize avoidable tokens through authorized:
- retrieval;
- filtering;
- deduplication;
- relevance ranking;
- bounded context assembly.

Every model call should retain estimated and actual cost when available.

Cost limits may deny or constrain work according to canonical policy, but cost optimization MUST NOT silently route below the minimum reliable tier.

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

## 15. Transport independence
Telegram, Discord, Web/API, Email, voice and the future native SG interface are clients of the same AR2 policy.

Transport metadata may be bounded input facts but transport never owns tier/model selection.

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
- estimated/actual cost.

Operational metrics should include tier distribution and escalation rate. A high L1→L2 escalation rate indicates a poor routing policy and should lead to policy tuning, not hidden repeated calls.

## 19. Implementation stages
- AR2.1 Routing Contract
- AR2.2 Tier-aware Model Registry
- AR2.3 Deterministic L0 Gate
- AR2.4 Task Assessment
- AR2.5 Tier Selector
- AR2.6 Specialty + Tier Routing
- AR2.7 Reasoning Effort Selector
- AR2.8 Validation
- AR2.9 Semantic Escalation
- AR2.10 Cost Intelligence & Observability

Each stage requires implementation, tests/regressions, `npm run check`, exact-HEAD SG 2.1 CI evidence and documentation synchronization before closure.

## 20. Non-negotiable boundaries
- one AI Router only;
- no direct provider bypass;
- no second authorization/security stack;
- no hard-coded provider product names in business logic;
- no user/model self-selection of a more expensive tier;
- no semantic escalation loops;
- no documentation-only closure;
- existing Block 2.5 fallback/retry/timeout/policy/telemetry semantics remain valid and are extended, not discarded.

## Canonical relationships
- Foundation/implementation program: `../roadmap/02_5_AI_ROUTING_FOUNDATION.md`
- AI model principle: `../AI_MODEL_PRINCIPLE.md`
- Transport boundary: `TRANSPORTS_AND_AI_ROUTING.md`
- Current lifecycle truth: `../roadmap/CURRENT_STATUS.md`
