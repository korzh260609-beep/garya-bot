# Users Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Users / Access module.
- Fix the access-check boundary.
- Reduce guessing during future security/permission work.

Status: CANONICAL
Scope: Users / Access logical interfaces

---

## 0) Contract philosophy

Users / Access contracts define how identity/access decisions are obtained and enforced.

This file does not require exact current implementation names.
It defines the contract shape that future work must preserve.

If implementation diverges, the divergence must be made explicit.

---

## 1) Canonical boundary

Access-related decisions must go through an explicit access boundary.

Canonical logical boundary examples:
- user resolution
- role resolution
- `can(user, action)`
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

---

### 2.3 `can(user, action, context?)`
Purpose:
- answer whether a given user may perform a given action

Expected input:
- user/access subject
- action identifier
- optional scoped context relevant to the check

Preconditions:
- action is explicit
- user is resolved enough for policy evaluation

Postconditions:
- returns allow/deny result or equivalent explicit access result
- decision is reproducible and reviewable
- privileged action paths are gated centrally

Must NOT do:
- rely on hidden handler-local exceptions
- allow privilege by omission
- bypass centralized access policy

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

---

### 2.5 `requestAccess(...)`
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
- avoid handler-local hidden privilege logic
- treat denial as part of correct behavior, not as an error to bypass

Caller must NOT:
- assume access by default
- embed duplicate policy branches ad hoc
- treat “worked once” as authorization

---

## 4) Side effects

Users / Access operations may have side effects such as:

- role lookup
- permission evaluation
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
- policy blocks access
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

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- privileged handler branches without centralized access checks
- access rules hidden inside transport adapters
- role checks duplicated inconsistently across modules
- granting access implicitly by context guess
- bypassing `can(...)`-style policy boundary for sensitive actions

---

## 7) Future contract expansion

Future additions may include contracts for:

- richer grant models
- role plans/limits
- fine-grained feature access
- audit event integration
- temporary access windows
- multi-channel identity-linked access decisions

These additions must preserve the same principles:
- explicit
- centralized
- reviewable
- deny-safe

---

## 8) Final rule

Users / Access contracts exist to make privilege and permission predictable.

If access decisions become scattered or implicit,
the system becomes unsafe even when it still “works”.