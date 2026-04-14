# Bot Module — RISKS

Purpose:
- Document the main risk surface of the Bot module.
- Prevent handler bloat, hidden branching, and orchestration drift.
- Keep user-entry logic predictable.

Status: CANONICAL
Scope: Bot module risk model

---

## 0) Why this file matters

Bot-layer damage is dangerous because it starts conveniently:

- one small exception in a handler
- one extra direct DB call
- one provider shortcut
- one role-specific branch

Then suddenly the handlers are the real system.

This file exists to stop that drift early.

---

## 1) Primary risks

### R-01: Handlers become fat
Description:
- too much business logic accumulates inside bot handlers

Consequence:
- modular boundaries erode
- testing becomes harder
- logic is duplicated
- future refactors get expensive

Signal:
- handlers grow large and know too much

---

### R-02: Routing becomes hidden or ambiguous
Description:
- dispatch rules are unclear or split across many files

Consequence:
- wrong handler chosen
- debugging difficulty
- accidental behavior changes

Signal:
- it is hard to explain why one input triggered one path

---

### R-03: Bot starts owning policy
Description:
- access, memory, or source policy gets invented locally in handlers

Consequence:
- hidden policy drift
- inconsistent behavior
- security or correctness issues

Signal:
- handlers contain many special-case rules that belong elsewhere

---

### R-04: Formatting mutates meaning
Description:
- user-facing formatting layer quietly changes the real semantic outcome

Consequence:
- misleading outputs
- hidden failure masking
- harder diagnostics

Signal:
- formatted response says something stronger/safer than the underlying result justified

---

### R-05: Fallback behavior becomes guesswork
Description:
- fallback paths do too much hidden interpretation/execution

Consequence:
- feature behavior becomes unpredictable
- debugging and safety review get harder

Signal:
- fallback feels “magic” but not reviewable

---

### R-06: Docs drift from real handler/routing behavior
Description:
- bot entry behavior changes while module/global docs remain stale

Consequence:
- AI and humans code against false assumptions
- hidden regressions become easier

Signal:
- docs describe one route model, runtime behaves another way

---

## 2) Secondary risks

### R-07: One command owns too much
Consequence:
- blast radius increases

### R-08: Group/private behavior diverges invisibly
Consequence:
- inconsistent UX and hard debugging

### R-09: Handler reuse is poor
Consequence:
- duplicate flows appear

### R-10: Bot-to-module boundaries blur
Consequence:
- ownership confusion spreads

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “it is just one quick handler shortcut”
- “routing can be cleaned up later”
- “the handler already has everything it needs”
- “formatting is harmless”
- “one exception will not hurt”
- “the bot layer is the easiest place, so put it there”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Bot changes

After any meaningful Bot change, verify:

1. handlers are still thin enough
2. routing remains explainable
3. access/memory/source logic did not leak in
4. formatting did not hide critical semantics
5. fallback remains bounded and reviewable
6. docs still match actual route/handler behavior

---

## 5) Risk handling strategy

Preferred defenses:

- explicit dispatcher
- thin handlers
- clear delegation
- bounded formatting role
- visible fallbacks
- stale-doc detection

Avoid fake safety:
- convenient handler exceptions
- hidden routing branches
- feature logic stuffed into chat entry files
- response polish masking real failures

---

## 6) Highest-priority rule

The most dangerous bot bug is not always a crash.

The most dangerous bug is:
“the bot still works, but handlers have quietly become the real architecture.”

That makes every later change more expensive and more fragile.