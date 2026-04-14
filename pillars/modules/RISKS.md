# Users Module — RISKS

Purpose:
- Document the main risk surface of the Users / Access module.
- Prevent privilege drift, hidden bypasses, and security confusion.
- Keep access control explicit.

Status: CANONICAL
Scope: Users / Access module risk model

---

## 0) Why this file matters

Access bugs are dangerous because they often look like convenience:

- one small exception
- one shortcut for admin flow
- one handler-local bypass
- one “temporary” role branch

Then later nobody knows the real rules.

This file exists to stop that drift early.

---

## 1) Primary risks

### R-01: Access logic becomes scattered
Description:
- checks are duplicated across handlers/modules
- no single reviewable access path remains

Consequence:
- inconsistent permission behavior
- hidden bypasses
- harder audits
- harder future refactoring

Signal:
- multiple ad hoc role checks across unrelated files
- no clear `can(...)` ownership

---

### R-02: Privileged actions bypass central checks
Description:
- sensitive actions run without explicit centralized access enforcement

Consequence:
- privilege escalation risk
- fragile security model
- hidden unsafe operator surfaces

Signal:
- admin/monarch-only actions guarded only by local assumptions

---

### R-03: Identity and access are conflated
Description:
- “who the user is” and “what they may do” are mixed carelessly

Consequence:
- wrong permissions
- brittle multi-channel logic
- confusing future upgrades

Signal:
- platform identity state directly treated as authorization without proper policy step

---

### R-04: Deny paths are weak or ambiguous
Description:
- access denial is inconsistent, partial, or easy to bypass

Consequence:
- protected actions may partially execute
- operators get misleading results
- security logic becomes unreliable

Signal:
- protected flow starts before access result is final
- denial is handled as cosmetic UI only

---

### R-05: Special cases multiply
Description:
- many one-off exceptions accumulate

Consequence:
- access model becomes unreadable
- future bugs become likely
- testing becomes harder

Signal:
- “just for this command”
- “just for this role”
- “just for this channel”

---

### R-06: Docs drift away from real access behavior
Description:
- actual access behavior changes, but module/global docs are not updated

Consequence:
- humans and AI work from false assumptions
- security review quality drops

Signal:
- docs say one thing, runtime allows another

---

## 2) Secondary risks

### R-07: Over-permissive fallback
Consequence:
- access is granted when data is ambiguous

### R-08: Over-restrictive fallback
Consequence:
- legitimate workflows fail or become brittle

### R-09: Unclear action taxonomy
Consequence:
- checks are inconsistent because actions are not well defined

### R-10: Missing audit visibility
Consequence:
- denies/grants cannot be reviewed properly

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “this command is obviously admin-only”
- “we do not need a real check here”
- “the handler already knows the user”
- “temporary exception is harmless”
- “identity resolution automatically means authorization”
- “it is fine because only the monarch uses it now”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Users / Access changes

After any meaningful Users / Access change, verify:

1. privileged actions still pass centralized checks
2. no new handler-local bypasses appeared
3. identity resolution and access policy remain distinct
4. deny paths are explicit and safe
5. role logic did not fragment across modules
6. docs still match actual access behavior

---

## 5) Risk handling strategy

Preferred defenses:

- centralized access boundary
- explicit action names
- deny-safe defaults
- reviewable role logic
- audit/telemetry hooks
- stale-doc detection

Avoid fake safety:
- implicit trust by context
- hidden special cases
- handler-local privilege assumptions
- undocumented operator shortcuts

---

## 6) Highest-priority rule

The most dangerous access bug is not always a visible exploit.

The most dangerous bug is:
“the system still feels normal, but privilege logic is now scattered and no longer reviewable.”

That is how security degrades quietly.