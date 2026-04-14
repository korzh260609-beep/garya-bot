# AI Routing Module — README

Purpose:
- Define the AI Routing / Model Control module as a stable responsibility domain.
- Fix what belongs to model selection, routing policy, and direct-AI-call discipline.
- Prevent AI usage from being decided ad hoc across the system.

Status: CANONICAL
Scope: AI Routing / Model Control logical module

---

## 0) Module purpose

The AI Routing / Model Control module is responsible for:

- selecting the appropriate AI path/model class
- enforcing centralized AI-call policy
- preserving model/provider abstraction
- keeping AI usage explicit and reviewable
- supporting future multi-model evolution without breaking system boundaries

This module exists so SG can use AI predictably rather than by scattered local choices.

---

## 1) In scope

AI Routing / Model Control includes responsibilities such as:

- centralized model selection
- task-to-model routing policy
- AI call entry discipline
- provider/model abstraction
- cost/reason-aware routing hooks
- fallback routing policy where explicitly allowed

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

Also out of scope:
- direct local feature ownership just because AI is involved
- architecture decisions by model convenience

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

---

## 5) Hard invariants

The following invariants must hold:

- direct AI calls must not be scattered across the codebase
- model selection must remain centralized enough to review
- AI routing must not replace explicit governance rules
- provider/model abstraction must be preserved
- hidden AI-call side paths are forbidden
- routing policy must remain explicit enough to debug

---

## 6) Relationship to adjacent modules

AI Routing / Model Control is closely related to:

- Bot
- File-Intake
- Sources
- Memory
- Logging / Diagnostics
- Tasks

But AI Routing does not own those modules.

It owns AI-call discipline and routing boundaries.

---

## 7) Examples of what AI Routing may do

Allowed examples:

- choose configured default model path
- map task cost level to model tier
- enforce centralized AI call entry
- provide provider abstraction/fallback policy
- record reason/cost-oriented routing metadata hooks
- prevent direct local model invocation patterns

These are AI Routing responsibilities.

---

## 8) Examples of what AI Routing must not do

Forbidden examples:

- letting every handler choose any model ad hoc
- deciding permissions because AI is involved
- replacing file extraction with generic AI guesses where extraction discipline is required
- embedding business logic into routing policy
- silently changing governance because a model is more convenient

These break architectural control.

---

## 9) Ownership rule

If the question is:
- whether AI should be called
- which model/provider tier should be used
- how to keep model usage centralized
- how to preserve provider abstraction

it belongs here.

If the question is:
- what the feature should do
- what data should be fetched
- what file extractor should run
- who is allowed to use the feature
- how user-facing output is routed

then it belongs elsewhere.

---

## 10) Final rule

AI Routing exists so SG uses AI deliberately, not impulsively.

If AI choices become scattered,
the whole system becomes harder to govern, debug, and price.