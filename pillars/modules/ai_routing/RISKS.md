# AI Routing Module — RISKS

Purpose:
- Document the main risk surface of the AI Routing / Model Control module.
- Prevent scattered model calls, hidden fallback behavior, and governance drift through AI convenience.
- Keep AI usage explicit and controllable.

Status: CANONICAL
Scope: AI Routing / Model Control module risk model

---

## 0) Why this file matters

AI usage feels powerful, so it tends to spread.

Typical drift pattern:
- one direct model call in a handler
- then another “temporary” one
- then per-feature model choices
- then hidden fallbacks
- then nobody knows the real AI policy anymore

This file exists to stop that drift.

---

## 1) Primary risks

### R-01: Direct AI calls scatter across modules
Description:
- features call models/providers directly without central routing

Consequence:
- weak governance
- inconsistent behavior/cost
- harder debugging
- fragile future provider changes

Signal:
- many local model invocations outside central AI entry

---

### R-02: Model choice becomes ad hoc
Description:
- each feature picks model/provider by convenience

Consequence:
- inconsistent quality
- inconsistent cost
- hidden behavior differences
- poor reviewability

Signal:
- no clear answer to why one model was used instead of another

---

### R-03: Hidden fallback behavior appears
Description:
- provider/model failure causes silent unreviewed fallback changes

Consequence:
- capability degradation is hidden
- output quality changes unpredictably
- operators cannot reason about real behavior

Signal:
- same feature behaves differently after failure but with no explicit routing explanation

---

### R-04: AI Routing starts owning feature logic
Description:
- routing layer starts deciding too much about feature semantics

Consequence:
- blurred module boundaries
- feature logic hidden in routing internals
- harder architecture review

Signal:
- routing code contains lots of feature-specific business meaning

---

### R-05: AI convenience overrides governance
Description:
- architecture rules bend because one model/provider is convenient

Consequence:
- explicit rules erode
- provider lock-in pressure rises
- system discipline weakens

Signal:
- “just call this model directly here, it is easier”

---

### R-06: Docs drift from actual AI-call behavior
Description:
- routing behavior evolves but docs remain stale

Consequence:
- AI/humans build on false assumptions
- cost/safety review quality drops

Signal:
- docs describe one routing model, runtime behaves another way

---

## 2) Secondary risks

### R-07: Over-centralization with poor flexibility
Consequence:
- valid routing evolution becomes too hard

### R-08: Under-centralization
Consequence:
- scattered policy and call paths

### R-09: Cost reasoning is weak
Consequence:
- expensive paths spread unnoticed

### R-10: Provider abstraction is thin or fake
Consequence:
- future switching becomes painful

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “one direct model call will not hurt”
- “this feature is special”
- “fallback can stay undocumented”
- “AI routing is just config”
- “model choice is an implementation detail only”
- “cost/safety/governance can be reviewed later”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after AI Routing changes

After any meaningful AI Routing change, verify:

1. AI calls still go through the central boundary
2. model/provider choice remains explainable
3. hidden fallback behavior did not appear
4. routing layer did not absorb feature semantics
5. provider abstraction still holds
6. docs still match actual AI-routing behavior

---

## 5) Risk handling strategy

Preferred defenses:

- centralized call boundary
- explicit routing choice
- bounded fallback policy
- provider abstraction
- routing observability
- stale-doc detection

Avoid fake safety:
- undocumented direct calls
- convenience-based model selection
- hidden fallback degradation
- routing logic secretly owning feature policy

---

## 6) Highest-priority rule

The most dangerous AI-routing bug is not “one provider failed”.

The most dangerous bug is:
“AI behavior keeps changing through scattered local calls and hidden fallbacks, but nobody can review the real routing policy.”

That destroys architectural control.