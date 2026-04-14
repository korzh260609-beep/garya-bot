# Sources Module — RISKS

Purpose:
- Document the main risk surface of the Sources module.
- Prevent silent drift from source-first behavior into guesswork, hidden fallbacks, and unreliable data flow.
- Keep source usage explicit and trustworthy.

Status: CANONICAL
Scope: Sources module risk model

---

## 0) Why this file matters

Source problems are dangerous because they often look like temporary inconvenience:

- provider returns error
- region/runtime blocks access
- payload shape changes
- rate-limit hits
- source becomes slow or flaky

The temptation is to hide the problem and keep the feature looking “smart”.

That is exactly how trust degrades.

This file exists to make those risks explicit.

---

## 1) Primary risks

### R-01: Source failure is hidden
Description:
- provider/runtime failure is masked instead of reported clearly

Consequence:
- downstream layers work on false assumptions
- operators misdiagnose the problem
- trust in reports/answers drops

Signal:
- generic fallback text with no real source status
- “seems okay” behavior despite source failure

---

### R-02: Missing data is invented
Description:
- unavailable or malformed source data is replaced by guesswork

Consequence:
- false outputs
- fake confidence
- misleading downstream reasoning

Signal:
- system produces strong conclusions while source availability is actually broken

---

### R-03: Provider logic leaks everywhere
Description:
- source-specific fetching/parsing is duplicated outside the Sources boundary

Consequence:
- inconsistent behavior
- harder upgrades
- normalization drift
- more bugs on provider changes

Signal:
- direct endpoint calls scattered across unrelated modules

---

### R-04: Normalization is weak or skipped
Description:
- downstream code consumes raw provider payload where normalized shape is expected

Consequence:
- brittle logic
- provider-coupled bugs
- hard-to-debug data inconsistencies

Signal:
- feature code knows too much about one provider’s raw response format

---

### R-05: Runtime limitations are misread
Description:
- provider unavailability, HTTP restrictions, or regional blocks are treated as internal logic bugs or ignored

Consequence:
- wrong fixes
- wasted debugging effort
- repeated false assumptions about source health

Signal:
- same provider failure keeps recurring, but the system still treats it as if data should be available

---

### R-06: Docs drift from actual source reality
Description:
- runtime source status/limitations change, but module/global docs remain stale

Consequence:
- AI and humans build on outdated assumptions
- operator trust drops
- source-first discipline weakens

Signal:
- docs say provider is active, runtime consistently shows restriction or pause

---

## 2) Secondary risks

### R-07: Over-tight source policy
Consequence:
- useful source functionality becomes unnecessarily hard to use

### R-08: Over-loose source policy
Consequence:
- chaotic source growth and poor reviewability

### R-09: Hidden fallback provider switching
Consequence:
- data lineage becomes unclear

### R-10: Diagnostics are too vague
Consequence:
- source problems cannot be separated into config/runtime/provider classes

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “it is okay to guess if the API failed”
- “users do not need to know the source is unavailable”
- “raw payload is close enough”
- “we can normalize later”
- “provider failures are mostly temporary noise”
- “if one provider is blocked, we can silently pretend another is equivalent”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Sources changes

After any meaningful Sources change, verify:

1. source failures remain explicit
2. no fabricated data appears on failure paths
3. provider-specific logic did not leak outside Sources
4. normalized-vs-raw boundaries still hold
5. runtime/provider restrictions remain visible
6. docs still match actual source behavior and limitations

---

## 5) Risk handling strategy

Preferred defenses:

- explicit source boundary
- explicit normalization
- strong diagnostics
- visible runtime/provider limitations
- bounded source outputs
- stale-doc detection

Avoid fake safety:
- silent fallback guessing
- undocumented provider substitution
- generic “all good” messaging when source is down
- hidden raw-payload coupling

---

## 6) Highest-priority rule

The most dangerous source bug is not always a failed API call.

The most dangerous bug is:
“the source is unreliable or unavailable, but the system still talks as if it knows.”

That destroys trust faster than a visible failure.