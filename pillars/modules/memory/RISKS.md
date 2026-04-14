# Memory Module — RISKS

Purpose:
- Document the main risk surface of the Memory module.
- Help future work avoid silent corruption and architectural drift.
- Make likely failure modes explicit.

Status: CANONICAL
Scope: Memory module risk model

---

## 0) Why this file matters

Memory bugs are dangerous because they often look useful at first.

The system may appear “smarter” while actually becoming:
- noisier
- less predictable
- more privacy-risky
- harder to debug

This file exists to keep that visible.

---

## 1) Primary risks

### R-01: Memory becomes a dump
Description:
- too much content is stored
- curation weakens
- memory loses semantic value

Consequence:
- noisy context
- lower answer quality
- more contradictions
- harder future maintenance

Signal:
- memory contains raw dialogue, weak facts, speculative scraps

---

### R-02: Handlers bypass memory boundary
Description:
- handlers or unrelated modules write/read memory directly

Consequence:
- rules fragment
- policy becomes inconsistent
- bugs become hard to trace

Signal:
- memory semantics differ by caller
- SQL/storage logic leaks into handlers

---

### R-03: Chat history and memory get mixed
Description:
- raw messages are treated as reusable memory without separation

Consequence:
- memory pollution
- prompt overload
- privacy and attribution confusion

Signal:
- “just dump recent chat into memory”
- lack of distinction between recall and memory

---

### R-04: Memory stores forbidden artifacts
Description:
- raw repo code or other forbidden content enters memory

Consequence:
- policy violation
- storage misuse
- possible leak/amplification of content that should remain elsewhere

Signal:
- source code bodies or other disallowed raw artifacts appear in memory records

---

### R-05: Context selection becomes uncontrolled
Description:
- context builder returns too much or poorly filtered memory

Consequence:
- token waste
- noisy answers
- wrong relevance ranking
- harder debugging

Signal:
- very large prompt context
- repeated irrelevant memory usage

---

### R-06: Memory semantics drift over time
Description:
- module behavior changes but docs/contracts are not updated

Consequence:
- AI tools and humans work against false assumptions
- future changes become unsafe

Signal:
- docs say one thing, runtime behaves differently

---

## 2) Secondary risks

### R-07: Dedupe is too weak
Consequence:
- repeated memory clutter

### R-08: Dedupe is too aggressive
Consequence:
- useful memory lost or blocked

### R-09: Scope leaks
Consequence:
- unrelated memory appears in wrong context

### R-10: Hidden fallback behavior
Consequence:
- failures are masked
- corruption spreads quietly

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “more memory is always better”
- “recent chat = long-term memory”
- “if it helps once, store it forever”
- “temporary helper storage can later be cleaned up”
- “small bypasses are harmless”
- “AI will figure out what is important”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Memory changes

After any meaningful Memory change, verify:

1. writes still go through the memory boundary
2. forbidden content does not enter memory
3. bounded context selection still works
4. unrelated scopes are not mixed
5. duplicate pressure did not increase unexpectedly
6. docs/contracts still match real behavior

---

## 5) Risk handling strategy

Preferred defenses:

- strict boundary ownership
- explicit contracts
- bounded context
- policy checks
- observability/logging
- docs kept current

Avoid fake safety:
- silent fallback behavior
- undocumented heuristics
- ad hoc caller exceptions

---

## 6) Highest-priority rule

The most dangerous memory bug is not always a crash.

The most dangerous memory bug is:
“the system still works, but now reasons from wrong or noisy context.”

That must be treated as a serious architectural risk.