# Users Module — RISKS

Purpose:
- Document the main risk surface of the Users / Access module.
- Prevent privilege drift, hidden bypasses, privacy leaks and security confusion.
- Keep access control explicit and aligned with `pillars/DECISIONS.md`.

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

Canonical rule:

```text
SG is free in thinking.
SG is controlled in actions.
```

The Users / Access module must protect actions, private data, scopes, costs and external surfaces.
It must not become a censorship layer over SG thinking, analysis or advisory planning.

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

### R-07: Permissions are mistaken for control over thinking
Description:
- access rules are used to block SG from analysis, critique or planning even when no protected action/data exposure happens

Consequence:
- SG becomes less useful
- reasoning gets artificially restricted
- architecture contradicts `DECISIONS.md`

Signal:
- “not allowed to think about this” when the real issue is only “not allowed to execute/apply/access private data”

---

### R-08: Permission is mistaken for execution approval
Description:
- a user may have permission for an action, but the system skips required confirmation for risky/state-changing/external/costly execution

Consequence:
- accidental repo/runtime/data changes
- unexpected costs
- loss of user/monarch control

Signal:
- allowed action runs immediately without confirmation despite risk/cost/state-change

---

### R-09: User/project isolation weakens
Description:
- access logic allows one user/project context to bleed into another

Consequence:
- privacy breach
- wrong project context
- loss of multiuser trust

Signal:
- user receives another user's memory, repo, project state, source result or settings

---

## 2) Secondary risks

### R-10: Over-permissive fallback
Consequence:
- access is granted when data is ambiguous

### R-11: Over-restrictive fallback
Consequence:
- legitimate advisory workflows fail or become brittle

### R-12: Unclear action taxonomy
Consequence:
- checks are inconsistent because actions are not well defined

### R-13: Missing audit visibility
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
- “if permission allows it, confirmation is unnecessary”
- “permissions should control what SG can think about”
- “project context can be reused if it is useful”

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
7. permissions protect actions/data/scope, not non-applied thinking
8. confirmation still exists for risky/state-changing/external/costly actions
9. user/project isolation remains enforced

---

## 5) Risk handling strategy

Preferred defenses:

- centralized access boundary
- explicit action names
- explicit user/project/data scope
- deny-safe defaults
- confirmation requirements for risky actions
- reviewable role logic
- audit/telemetry hooks
- stale-doc detection

Avoid fake safety:
- implicit trust by context
- hidden special cases
- handler-local privilege assumptions
- undocumented operator shortcuts
- confusing advisory analysis with execution permission

---

## 6) Highest-priority rule

The most dangerous access bug is not always a visible exploit.

The most dangerous bug is:
“the system still feels normal, but privilege logic is now scattered and no longer reviewable.”

A second critical bug is:
“permissions start controlling SG thinking instead of controlling protected actions and data.”

Both degrade SG quietly.