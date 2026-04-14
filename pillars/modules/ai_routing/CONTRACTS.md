# AI Routing Module — CONTRACTS

Purpose:
- Define the public contract expectations of the AI Routing / Model Control module.
- Fix the centralized AI-call and model-selection boundary.
- Reduce guessing during future AI/provider expansion.

Status: CANONICAL
Scope: AI Routing / Model Control logical interfaces

---

## 0) Contract philosophy

AI Routing contracts define how AI usage is entered, selected, and controlled centrally.

This file does not require exact current implementation names.
It defines the contract shape that future AI-routing work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

AI-related execution must go through an explicit routing boundary.

Canonical logical capabilities may include:

- decide whether AI is needed
- choose model/provider path
- execute call through centralized entry
- record routing reason/cost metadata
- apply bounded fallback policy where explicitly allowed

The exact file/function names may evolve.
The boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `shouldCallAI(taskContext, ...)`
Purpose:
- determine whether AI invocation is justified for the current flow

Expected input:
- explicit task/request context
- optional cost/risk/classification hints

Preconditions:
- task/request context is explicit enough for routing judgment
- non-AI alternatives are not being ignored implicitly

Postconditions:
- returns explicit yes/no/routing decision or equivalent bounded result
- AI usage remains reviewable rather than impulsive

Must NOT do:
- hide automatic AI invocation under unrelated code paths
- pretend AI is mandatory for everything

---

### 2.2 `selectModel(taskContext, costLevel, ...)`
Purpose:
- choose the appropriate model/provider route for a justified AI call

Expected input:
- explicit task/request context
- cost/risk/quality level hints
- available model/provider configuration

Preconditions:
- AI invocation is already justified or equivalent explicit path exists
- model/provider config is available

Postconditions:
- returns explicit routing choice or controlled failure
- routing reason remains explainable enough

Must NOT do:
- allow arbitrary local model choice by convenience
- hide unavailable model/provider state

---

### 2.3 `callAI(messagesOrPayload, routingChoice, ...)`
Purpose:
- perform the AI call through centralized entry

Expected input:
- bounded AI payload/messages
- explicit routing choice
- optional metadata such as reason/cost level

Preconditions:
- routing choice exists
- payload is bounded enough
- AI call is permitted by current architecture/policy

Postconditions:
- AI result or controlled failure is returned
- AI invocation remains traceable enough for diagnostics/cost review

Must NOT do:
- bypass centralized routing policy
- silently change provider/model path without explicit policy
- mutate architecture rules because one model is convenient

---

### 2.4 `recordRoutingMeta(callContext, ...)`
Purpose:
- record bounded metadata about why/how routing happened where policy requires it

Expected input:
- routing context
- selected model/provider
- optional reason/cost metadata

Preconditions:
- routing decision already exists
- metadata is bounded enough to store/log

Postconditions:
- routing remains more reviewable for diagnostics/cost visibility

Must NOT do:
- become a hidden control dependency
- expose more detail than governance allows

---

### 2.5 `fallbackRoute(callContext, failure, ...)`
Purpose:
- choose bounded fallback behavior if explicit fallback policy exists

Expected input:
- original call/routing context
- explicit failure state

Preconditions:
- fallback is allowed by policy
- fallback options are explicit

Postconditions:
- fallback remains reviewable and bounded
- model/provider failure does not silently become hidden arbitrary behavior

Must NOT do:
- invent unapproved fallback models/providers
- hide significant degradation in capability/quality

---

## 3) Caller obligations

Any caller using AI Routing must:

- use centralized AI entry
- provide explicit task/request context
- keep payloads bounded
- treat routing decisions as policy-bound rather than arbitrary

Caller must NOT:
- call models directly from local feature code
- hardcode provider choice ad hoc
- confuse extraction/routing/permissions with AI selection

---

## 4) Side effects

AI Routing operations may have side effects such as:

- model selection
- AI invocation
- routing metadata logging
- cost/risk telemetry hooks
- bounded fallback handling

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

AI Routing operations should fail in a controlled way when:

- AI is not justified for the task
- model/provider config is unavailable
- selected route is invalid
- payload is malformed/unbounded
- provider/model call fails
- fallback is unavailable or forbidden

Preferred behavior:
- explicit failure/degradation
- reviewable routing outcome
- no hidden direct-call bypass

Forbidden behavior:
- arbitrary local model choice on failure
- silent provider switching without policy
- hidden direct AI invocation outside routing boundary

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- direct model/provider calls scattered across features
- per-handler ad hoc model choice without central policy
- using AI routing to smuggle in feature logic ownership
- hiding major fallback degradation
- treating AI convenience as architecture authority

---

## 7) Future contract expansion

Future additions may include contracts for:

- multi-model orchestration
- specialized modality routing
- cost-governed confirmation flows
- provider capability registry
- routing diagnostics
- AI budget governance hooks

These additions must preserve the same principles:
- centralized
- explicit
- reviewable
- provider-agnostic enough to evolve safely

---

## 8) Final rule

AI Routing contracts exist so SG can use AI under control.

If AI-call boundaries become vague,
the system loses cost, safety, and architectural discipline.