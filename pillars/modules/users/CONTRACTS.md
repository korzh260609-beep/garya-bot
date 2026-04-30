# Users Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Users / Access module.
- Fix the access-check boundary.
- Keep permissions aligned with `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: Users / Access logical interfaces

---

## 0) Contract philosophy

Users / Access contracts define how identity, scope, roles, permissions and confirmations are obtained and enforced.

This module is not SG itself.
It is not SG governance authority by itself.
It is a control boundary for actions, data, scopes and surfaces.

Canonical rule:

```text
SG is free in thinking.
SG is controlled in actions.
```

Therefore access policy must protect:
- state-changing actions;
- private data;
- cross-user scope;
- external actions;
- repository/runtime changes;
- costly operations;
- privileged admin/monarch surfaces.

Access policy must not block SG from non-applied thinking, analysis, comparison, planning, critique or advisory output when no protected action/data exposure occurs.

This file does not require exact current implementation names.
It defines the contract shape that future work must preserve.

If implementation diverges, the divergence must be made explicit.

---

## 1) Canonical boundary

Access-related decisions must go through an explicit access boundary.

Canonical logical boundary examples:
- user resolution
- global identity resolution
- role resolution
- scope/project resolution
- `can(user, action, context?)`
- confirmation requirement resolution
- access request handling
- privilege enforcement

The exact file/function names may evolve.
The access boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `resolveUser(context)`
Purpose:
- resolve the effective system user/access subject from runtime context

Expected input:
- runtime/core context
- platform/user identifiers or linked identity information as available

Preconditions:
- caller provides explicit runtime context
- enough identity information exists for bounded resolution or controlled failure

Postconditions:
- returns a resolvable user/access subject
- role/access evaluation can continue from this result
- ambiguity is explicit, not hidden

Must NOT do:
- silently grant elevated authority
- invent access state without rules
- treat platform identity alone as full authorization

---

### 2.2 `resolveRole(user)`
Purpose:
- determine effective role/access level for the current user

Expected input:
- resolved user/access subject

Preconditions:
- user resolution already happened or equivalent safe input exists

Postconditions:
- returns explicit role/effective access state
- result can be used for permission checks

Must NOT do:
- hide special-case privilege branches
- silently mix unrelated policy sources
- confuse role with project ownership or data access scope

---

### 2.3 `can(user, action, context?)`
Purpose:
- answer whether a given user may perform a given action in a given scope

Expected input:
- user/access subject
- action identifier
- optional scoped context relevant to the check

Preconditions:
- action is explicit
- user is resolved enough for policy evaluation
- protected surface/data/scope is explicit where relevant

Postconditions:
- returns allow/deny result or equivalent explicit access result
- decision is reproducible and reviewable
- privileged action paths are gated centrally

Must NOT do:
- rely on hidden handler-local exceptions
- allow privilege by omission
- bypass centralized access policy
- treat thinking/advice as the same as applying an action

---

### 2.4 `require(user, action, context?)`
Purpose:
- enforce access requirement before protected behavior proceeds

Expected input:
- user/access subject
- action identifier
- optional scoped context

Preconditions:
- access target action is explicit

Postconditions:
- protected flow continues only if allowed
- denied actions fail in controlled manner
- denial may be observable/loggable

Must NOT do:
- partially execute protected logic before access result
- hide denial in ambiguous fallback behavior
- perform external/state-changing work before confirmation where confirmation is required

---

### 2.5 `requiresConfirmation(user, action, context?)`
Purpose:
- determine whether an allowed action still requires explicit user/monarch confirmation before execution

Expected input:
- user/access subject
- action identifier
- optional risk/cost/scope context

Preconditions:
- action and scope are explicit enough

Postconditions:
- returns confirmation requirement in a reviewable way
- protected actions do not execute only because role permission exists

Must NOT do:
- treat permission as automatic execution approval for high-risk actions
- hide cost/risk confirmation needs

---

### 2.6 `requestAccess(...)`
Purpose:
- handle a formal access request or promotion-related flow where applicable

Expected input:
- requesting user
- requested role/feature/action
- metadata/reason if policy requires

Preconditions:
- access request surface is enabled by policy/workflow
- request is within supported scope

Postconditions:
- request is stored/processed or safely rejected
- request state becomes reviewable

Must NOT do:
- auto-grant elevated access without approved policy
- silently mutate user role outside explicit rules

---

## 3) Caller obligations

Any caller using Users / Access must:

- resolve access through the explicit boundary
- provide explicit action names for checks
- provide explicit scope/project/data context where relevant
- avoid handler-local hidden privilege logic
- treat denial as part of correct behavior, not as an error to bypass

Caller must NOT:
- assume access by default
- embed duplicate policy branches ad hoc
- treat “worked once” as authorization
- expose private user/project data by convenience

---

## 4) Side effects

Users / Access operations may have side effects such as:

- role lookup
- permission evaluation
- confirmation requirement evaluation
- audit/logging hooks
- request persistence
- access-denied telemetry

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

Users / Access operations should fail in a controlled way when:

- identity is unresolved
- role is ambiguous
- action is missing/unknown
- scope/project/data target is ambiguous
- policy blocks access
- confirmation is required but absent
- request is invalid
- caller attempts to bypass access flow

Preferred behavior:
- explicit deny
- structured failure
- observable access decision path

Forbidden behavior:
- silent privilege escalation
- fallback into permissive behavior
- partial execution before deny
- action execution before required confirmation

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- privileged handler branches without centralized access checks
- access rules hidden inside transport adapters
- role checks duplicated inconsistently across modules
- granting access implicitly by context guess
- bypassing `can(...)`-style policy boundary for sensitive actions
- blocking SG advisory thinking as if it were an applied action
- treating Users / Access as owner of SG philosophy or final governance decisions

---

## 7) Future contract expansion

Future additions may include contracts for:

- richer grant models
- role plans/limits
- fine-grained feature access
- audit event integration
- temporary access windows
- multi-channel identity-linked access decisions
- user/project isolation checks
- cost-based confirmation checks

These additions must preserve the same principles:
- explicit
- centralized
- reviewable
- deny-safe
- action/data/scope focused

---

## 8) Final rule

Users / Access contracts exist to make privilege and permission predictable.

If access decisions become scattered or implicit,
the system becomes unsafe even when it still “works”.

Permissions control actions and protected data.
They do not replace SG thinking.