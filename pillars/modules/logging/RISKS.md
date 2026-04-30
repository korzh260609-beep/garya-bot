# Logging Module — RISKS

Purpose:
- Document the main risk surface of the Logging / Diagnostics module.
- Prevent silent failure, fake visibility, hidden control-plane drift and false operational confidence.
- Keep observability honest, bounded and aligned with `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: Logging / Diagnostics module risk model

---

## 0) Why this file matters

Observability can fail in two opposite ways:

1. too little visibility
2. too much noisy visibility with no meaning

Both are dangerous.

A system that “logs a lot” is not automatically observable.
A system that “has diagnostics” is not automatically diagnosable.

This file exists to keep that visible.

Logging / Diagnostics is an observability component of SG.
It is not SG itself, not SG brain and not a hidden action controller.

---

## 1) Primary risks

### R-01: Important failures are not logged
Description:
- real failure conditions happen but never become visible enough

Consequence:
- delayed debugging
- false confidence
- repeated hidden regressions

Signal:
- users/operators see wrong outcomes with no matching diagnostic trail

---

### R-02: Visibility is noisy but not useful
Description:
- many events exist, but event meaning is too vague or too fragmented

Consequence:
- operator overload
- hard root-cause review
- fake feeling of control

Signal:
- lots of logs, little actual clarity

---

### R-03: Logs become hidden control logic
Description:
- system starts depending on logging paths for real behavior/control

Consequence:
- architecture confusion
- brittle execution
- side-effect-driven bugs

Signal:
- “it works because logging path did X”
- business behavior tied to observability internals

---

### R-04: Diagnostics hide reality
Description:
- summaries oversimplify or soften failures too much

Consequence:
- operators underestimate real risk/failure rate
- wrong decisions follow

Signal:
- diagnostics look cleaner than underlying truth

---

### R-05: Sensitive diagnostics are too open
Description:
- diagnostic surfaces expose too much internal state or sensitive context

Consequence:
- security/privacy risk
- overexposed operator surface

Signal:
- broad access to detailed internal diagnostics without proper boundary

---

### R-06: Docs drift from real observability behavior
Description:
- logging/diagnostic surfaces evolve but docs stay stale

Consequence:
- operators and AI assume wrong visibility guarantees
- review quality drops

Signal:
- docs promise visibility that runtime no longer provides

---

### R-07: Diagnostics are mistaken for decision authority
Description:
- diagnostic summaries start deciding what must be done instead of showing evidence, status and risks

Consequence:
- final decision boundary erodes
- operators may confuse diagnostic suggestions with approved actions
- SG controlled-action model weakens

Signal:
- diagnostic output triggers action or governance changes without explicit permission/confirmation

---

### R-08: Logging is mistaken for source-of-truth
Description:
- logs are treated as complete factual reality even when instrumentation is partial, missing or stale

Consequence:
- false debugging conclusions
- hidden gaps remain invisible
- bad architectural decisions follow

Signal:
- “logs do not show it, therefore it did not happen” without checking instrumentation coverage

---

### R-09: Audit gaps on protected actions
Description:
- state-changing, external, private-data, repo, cost or permission-sensitive actions happen without sufficient audit visibility

Consequence:
- impossible accountability
- harder incident review
- loss of trust in action control

Signal:
- action occurred, but no clear who/what/why/when/scope trail exists

---

## 2) Secondary risks

### R-10: Event taxonomy is inconsistent
Consequence:
- poor filtering and trend review

### R-11: Failure categories collapse together
Consequence:
- config/runtime/logic issues become harder to distinguish

### R-12: Diagnostics are too expensive/heavy by default
Consequence:
- operational friction rises

### R-13: Missing boundedness
Consequence:
- observability itself becomes noisy or costly

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “we already log enough”
- “more logs automatically means better visibility”
- “diagnostic summary can hide details safely”
- “operators do not need exact failure classes”
- “logging is not part of correctness”
- “temporary missing visibility is okay”
- “diagnostics can decide the next action”
- “if logs are silent, nothing happened”
- “audit trails are optional for internal tools”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Logging changes

After any meaningful Logging / Diagnostics change, verify:

1. important failures still become visible
2. event taxonomy remains intelligible
3. diagnostics did not start hiding important truth
4. observability did not turn into hidden control logic
5. sensitive/internal diagnostics remain bounded appropriately
6. docs still match actual observability surfaces
7. diagnostics are not treated as SG/final decision authority
8. logs are not treated as complete source-of-truth without coverage review
9. protected actions have appropriate audit visibility

---

## 5) Risk handling strategy

Preferred defenses:

- explicit event taxonomy
- bounded useful diagnostics
- strong failure visibility
- separation between observability and control
- access-aware diagnostic surfaces
- audit events for protected actions
- instrumentation coverage awareness
- stale-doc detection

Avoid fake safety:
- noisy but meaningless logs
- polished summaries that hide issues
- silent missing telemetry
- hidden side-effect dependencies on logging code
- diagnostics that quietly become operators

---

## 6) Highest-priority rule

The most dangerous logging bug is not “no logs”.

The most dangerous bug is:
“operators think they can see the system, but the visibility is incomplete, misleading, or softened.”

That creates false confidence.

A second critical bug is:
“logging/diagnostics becomes a hidden control plane instead of observability.”