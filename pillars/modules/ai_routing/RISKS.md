# AI Routing Module — RISKS

Purpose:
- Document the main risk surface of the AI Routing / Model Control module.
- Prevent scattered model calls, hidden fallback behavior, governance drift, and false documentation confidence.
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

Important current note:
- AI Routing docs describe the canonical target architecture
- current runtime still has significant divergence from that target
- this divergence must be treated honestly

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

Current reality note:
- this is already present in current repository state
- therefore this risk is active technical debt, not just a theoretical warning

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

### R-06: AI router is only partial, but docs sound stronger than runtime
Description:
- canonical docs describe a centralized AI-routing layer, but current runtime still uses a more limited AI wrapper model

Consequence:
- false confidence
- AI tools and humans may assume stronger routing guarantees than actually exist
- refactor priorities may be misread

Signal:
- current AI entrypoint behaves more like a shared wrapper/fallback helper than a full routing/governance layer

Current reality note:
- this is one of the main current documentation-vs-runtime divergences
- it must be acknowledged explicitly

---

### R-07: Docs drift from actual AI-call behavior
Description:
- routing behavior evolves but docs remain stale

Consequence:
- AI/humans build on false assumptions
- cost/safety review quality drops

Signal:
- docs describe centralized routing discipline, but runtime still contains scattered direct calls and only partial routing implementation

---

## 2) Secondary risks

### R-08: Over-centralization with poor flexibility
Consequence:
- valid routing evolution becomes too hard

### R-09: Under-centralization
Consequence:
- scattered policy and call paths

### R-10: Cost reasoning is weak
Consequence:
- expensive paths spread unnoticed

### R-11: Provider abstraction is thin or fake
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
- “shared AI wrapper = full router”

These assumptions must be treated as risk factors.

---

## 4) Active technical debt explicitly acknowledged

The following debt is explicitly acknowledged in current runtime:

1. direct AI calls are still scattered outside the ideal routing boundary
2. current central AI entry is closer to a shared wrapper than to a full router with complete policy/governance logic
3. AI Routing as documented is ahead of runtime maturity
4. Tasks and possibly other modules still partially own their own AI invocation behavior

Important rule:
- this debt is recognized
- it is not canonical target architecture
- it must not be copied forward as the normal pattern

---

## 5) Regression checks after AI Routing changes

After any meaningful AI Routing change, verify:

1. AI calls still move toward the central boundary rather than away from it
2. model/provider choice remains explainable
3. hidden fallback behavior did not appear
4. routing layer did not absorb feature semantics
5. provider abstraction still holds
6. docs still match actual AI-routing behavior
7. scattered direct calls did not spread further

---

## 6) Risk handling strategy

Preferred defenses:

- centralized call boundary
- explicit routing choice
- bounded fallback policy
- provider abstraction
- routing observability
- stale-doc detection
- honest acknowledgement of partial runtime maturity

Avoid fake safety:
- undocumented direct calls
- convenience-based model selection
- hidden fallback degradation
- routing logic secretly owning feature policy
- pretending current wrapper-level reality is already a fully mature router

---

## 7) Highest-priority rule

The most dangerous AI-routing bug is not “one provider failed”.

The most dangerous bug is:
“AI behavior keeps changing through scattered local calls and hidden fallbacks, while docs imply stronger centralized control than runtime actually has.”

That destroys architectural control and creates false confidence.