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

Sources are evidence providers for SG.
They are not SG itself, and AI is not a replacement for missing evidence.

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

### R-07: AI output is mistaken for source evidence
Description:
- AI-generated explanation, memory recall or inference is presented as if it came from a real source

Consequence:
- factual reliability collapses
- user cannot verify claims
- source-first principle is broken

Signal:
- no source lineage exists, but output sounds source-backed

---

### R-08: Source lineage disappears
Description:
- data is fetched/normalized, but downstream layers lose where it came from

Consequence:
- trust review becomes difficult
- conflicting sources cannot be compared
- debugging factual errors becomes harder

Signal:
- result has values but no provider/source/run identity when it matters

---

### R-09: Source access crosses user/project scope
Description:
- one user's/project's configured source is used in another scope

Consequence:
- privacy/security breach
- wrong data in output
- multiuser trust damage

Signal:
- ordinary user receives Gary/project/private source data without explicit authorization

---

## 2) Secondary risks

### R-10: Over-tight source policy
Consequence:
- useful source functionality becomes unnecessarily hard to use

### R-11: Over-loose source policy
Consequence:
- chaotic source growth and poor reviewability

### R-12: Hidden fallback provider switching
Consequence:
- data lineage becomes unclear

### R-13: Diagnostics are too vague
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
- “AI can fill the missing facts”
- “source lineage is optional”
- “project source data is safe to reuse anywhere”

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
7. AI/memory output is not presented as source evidence
8. source lineage remains available where factual confidence matters
9. source access respects user/project scope

---

## 5) Risk handling strategy

Preferred defenses:

- explicit source boundary
- explicit normalization
- strong diagnostics
- visible runtime/provider limitations
- bounded source outputs
- source lineage/provenance
- user/project scope enforcement
- stale-doc detection

Avoid fake safety:
- silent fallback guessing
- undocumented provider substitution
- generic “all good” messaging when source is down
- hidden raw-payload coupling
- using AI as evidence substitute

---

## 6) Highest-priority rule

The most dangerous source bug is not always a failed API call.

The most dangerous bug is:
“the source is unreliable or unavailable, but the system still talks as if it knows.”

That destroys trust faster than a visible failure.

A second critical bug is:
“AI output is presented as source-backed fact.”