# AI Routing Module — README

Purpose:
- Define the AI Routing / Model Control module as a stable responsibility domain.
- Fix what belongs to model selection, routing policy, and direct-AI-call discipline.
- Prevent AI usage from being decided ad hoc across the system.
- Prevent AI Routing from becoming SG brain or heavy SemanticRouter.

Status: CANONICAL
Scope: AI Routing / Model Control logical module

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/architecture/SEMANTIC_ROUTING.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/architecture/PERMISSIONS_MAP.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Module purpose

The AI Routing / Model Control module is responsible for:

- selecting the appropriate AI path/model class
- enforcing centralized AI-call policy
- preserving model/provider abstraction
- keeping AI usage explicit and reviewable
- supporting future multi-model evolution without breaking system boundaries
- supporting cost/reason logging where available

This module exists so SG can use AI predictably rather than by scattered local choices.

AI Routing is a model/cost/control wrapper. It is not SG brain, not SG identity, and not a heavy SemanticRouter.

---

## 1) In scope

AI Routing / Model Control includes responsibilities such as:

- centralized model selection
- task-to-model routing policy
- AI call entry discipline
- provider/model abstraction
- cost/reason-aware routing hooks
- fallback routing policy where explicitly allowed
- enforcing no direct hidden model calls

Typical related code areas may include:
- AI router/service entry
- model configuration
- cost-level routing helpers
- provider abstraction layer
- AI call policy helpers

---

## 2) Out of scope

The AI Routing / Model Control module must NOT own:

- transport parsing
- business feature meaning
- memory semantics
- permission policy
- source-fetching logic
- file/media extraction logic
- user-facing command routing
- hidden prompt/governance authority
- SG philosophy, identity, or accepted decisions

Also out of scope:
- direct local feature ownership just because AI is involved
- architecture decisions by model convenience
- replacing reasoning/model meaning with hardcoded router logic
- acting as an autonomous multi-agent brain

---

## 3) Core idea

AI Routing must answer:

- should AI be called here at all?
- which model/provider class should be used?
- under what policy/cost/risk constraints?
- how does this stay centralized and reviewable?

It must not answer:
- what the feature itself means
- who is allowed to use it
- what non-AI modules should do internally
- what SG is or what SG may become

That distinction must remain hard.

---

## 4) Core responsibilities

The AI Routing / Model Control module is responsible for:

1. centralizing AI-call entry
2. selecting model/provider path explicitly
3. preserving model-agnostic architecture
4. exposing routing reason/cost hooks where required
5. preventing hidden direct model calls
6. supporting future routing evolution without scattering AI decisions
7. keeping AI calls compatible with controlled-action boundaries

---

## 5) Hard invariants

The following invariants must hold:

- direct AI calls must not be scattered across the codebase
- model selection must remain centralized enough to review
- AI routing must not replace explicit governance rules
- provider/model abstraction must be preserved
- hidden AI-call side paths are forbidden
- routing policy must remain explicit enough to debug
- AI Routing must not become SG brain
- AI Routing must not bypass source-first, permission, risk, cost, or confirmation policies

---

## 6) Controlled-action rule

AI calls may support:

```text
analysis-only
prepare-only
read-only explanation
expensive/costly processing
private-data processing
```

Rules:
- AI output is not automatically source of truth;
- expensive/costly AI usage may require warning/confirmation where configured;
- private-data AI usage must respect user/project/scope boundaries;
- AI may prepare drafts, diffs or plans without applying them;
- AI Routing must not perform external or state-changing actions by itself.

---

## 7) Relationship to adjacent modules

AI Routing / Model Control is closely related to:

- Bot
- File-Intake
- Sources
- Memory
- Logging / Diagnostics
- Tasks
- Users / Access

But AI Routing does not own those modules.

It owns AI-call discipline and routing boundaries.

---

## 8) Examples of what AI Routing may do

Allowed examples:

- choose configured default model path
- map task cost level to model tier
- enforce centralized AI call entry
- provide provider abstraction/fallback policy
- record reason/cost-oriented routing metadata hooks
- prevent direct local model invocation patterns
- reject or downgrade expensive calls according to policy

These are AI Routing responsibilities.

---

## 9) Examples of what AI Routing must not do

Forbidden examples:

- letting every handler choose any model ad hoc
- deciding permissions because AI is involved
- replacing file extraction with generic AI guesses where extraction discipline is required
- embedding business logic into routing policy
- silently changing governance because a model is more convenient
- becoming a heavy SemanticRouter or SG brain
- treating model output as verified fact when source-first data is required

These break architectural control.

---

## 10) Ownership rule

If the question is:
- whether AI should be called
- which model/provider tier should be used
- how to keep model usage centralized
- how to preserve provider abstraction
- how to log cost/reason metadata

it belongs here.

If the question is:
- what the feature should do
- what data should be fetched
- what file extractor should run
- who is allowed to use the feature
- how user-facing output is routed
- whether an action should be applied

then it belongs elsewhere.

---

## 11) Final rule

AI Routing exists so SG uses AI deliberately, not impulsively.

If AI choices become scattered,
the whole system becomes harder to govern, debug, and price.

If AI Routing becomes SG brain,
the architecture is wrong.