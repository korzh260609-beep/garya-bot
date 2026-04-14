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

Important current note:
- Bot documentation describes the target boundary correctly
- but current runtime still contains real handler-level debt
- this debt must not be mistaken for acceptable architecture

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

Current reality note:
- this risk is not theoretical
- current repository state already shows handler files carrying more logic than the ideal Bot boundary allows

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

### R-06: Direct SQL in handlers
Description:
- handlers execute database queries directly instead of delegating through clearer ownership boundaries

Consequence:
- Bot begins to own data/storage behavior
- business logic and persistence get mixed
- refactoring and permission review become harder
- handler files gain too much blast radius

Signal:
- direct `pool.query(...)` usage inside `src/bot/handlers/*`

Current reality note:
- this is already present in current repository state
- therefore this risk must be treated as active technical debt, not a hypothetical warning

---

### R-07: Docs drift from real handler/routing behavior
Description:
- bot entry behavior changes while module/global docs remain stale

Consequence:
- AI and humans code against false assumptions
- hidden regressions become easier

Signal:
- docs describe thin handlers, but runtime still contains mixed handler responsibility

---

## 2) Secondary risks

### R-08: One command owns too much
Consequence:
- blast radius increases

### R-09: Group/private behavior diverges invisibly
Consequence:
- inconsistent UX and hard debugging

### R-10: Handler reuse is poor
Consequence:
- duplicate flows appear

### R-11: Bot-to-module boundaries blur
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
- “direct SQL in a handler is fine if it works”

These assumptions must be treated as risk factors.

---

## 4) Active technical debt explicitly acknowledged

The following debt is explicitly acknowledged in current runtime:

1. some handlers are not thin enough
2. some handlers perform direct SQL work
3. some bot entry paths still carry more responsibility than the target Bot boundary allows

Important rule:
- this debt is recognized
- it is not canonical design
- it must not be copied into new code as a normal pattern

---

## 5) Regression checks after Bot changes

After any meaningful Bot change, verify:

1. handlers are still thin enough
2. routing remains explainable
3. access/memory/source logic did not leak in further
4. formatting did not hide critical semantics
5. fallback remains bounded and reviewable
6. direct SQL in handlers did not spread further
7. docs still match actual route/handler behavior

---

## 6) Risk handling strategy

Preferred defenses:

- explicit dispatcher
- thin handlers
- clear delegation
- bounded formatting role
- visible fallbacks
- stale-doc detection
- stopping further spread of direct SQL in handlers

Avoid fake safety:
- convenient handler exceptions
- hidden routing branches
- feature logic stuffed into chat entry files
- response polish masking real failures
- treating existing mixed handlers as acceptable precedent

---

## 7) Highest-priority rule

The most dangerous bot bug is not always a crash.

The most dangerous bug is:
“the bot still works, but handlers have quietly become the real architecture.”

Direct SQL inside handlers is one of the clearest signs of that drift.