# Users Module — README

Purpose:
- Define the Users / Access module as a stable responsibility domain.
- Fix what belongs to identity, roles, permissions, and access flow.
- Prevent access logic from scattering across the system.

Status: CANONICAL
Scope: Users / Access logical module

---

## 0) Module purpose

The Users / Access module is responsible for:

- identifying users
- resolving effective roles
- enforcing permissions/gates
- handling access-related flows
- protecting privileged operations

This module exists to keep “who can do what” explicit and centralized.

---

## 1) In scope

Users / Access includes responsibilities such as:

- user identification
- role resolution
- access checks
- permission gates
- access request handling
- protected command checks
- role-aware feature restrictions
- audit-oriented access enforcement boundaries

Typical related code areas may include:
- user access services
- role/permission logic
- access request helpers
- user profile/access metadata code

---

## 2) Out of scope

The Users / Access module must NOT own:

- transport parsing
- business feature execution itself
- memory semantics
- source-fetching logic
- repo indexing structure
- AI routing policy
- chat formatting
- platform adapter behavior

Also out of scope:
- hidden permission rules scattered inside handlers or adapters
- project governance decisions about architecture

---

## 3) Core idea

Users / Access must answer questions like:

- who is this user?
- what effective role do they have?
- may they perform this action?
- should access be denied, allowed, or escalated?

It must do this centrally and predictably.

---

## 4) Core responsibilities

The Users / Access module is responsible for:

1. identifying users in system terms
2. resolving role and access state
3. enforcing `can(user, action)`-style checks
4. protecting privileged/system-sensitive operations
5. keeping role/access logic centralized
6. preventing silent bypass paths

---

## 5) Hard invariants

The following invariants must hold:

- privileged actions must pass explicit access checks
- access rules must not be scattered ad hoc across modules
- role logic must remain reviewable and traceable
- handlers must not silently invent access exceptions
- transport must not replace the access layer
- access policy must remain explicit, not “implied by context”

---

## 6) Relationship to identity

Users / Access is closely related to identity,
but identity link mechanics and access policy are not the same thing.

Identity answers:
- who is this across platforms?

Access answers:
- what are they allowed to do?

These may interact, but must not be conflated.

---

## 7) Relationship to adjacent modules

Users / Access is closely related to:

- Transport
- Bot
- Memory
- Tasks
- Sources
- Repo
- Logging / Diagnostics

But this module does not own their internal logic.

It only owns access decisions about actions touching them.

---

## 8) Examples of what Users / Access may do

Allowed examples:

- determine whether current user is monarch/guest/citizen/etc.
- allow or deny admin command usage
- restrict sensitive repo operations
- enforce role-based feature limits
- record access requests and decisions
- expose centralized `can(...)` logic

These are access responsibilities.

---

## 9) Examples of what Users / Access must not do

Forbidden examples:

- implement full business feature logic
- decide memory content meaning
- fetch external source payloads itself
- parse platform payloads like a transport adapter
- route AI models
- become a generic “misc util” module

These blur boundaries and create hidden coupling.

---

## 10) Ownership rule

If the question is:
“is this user allowed to do this action?”

it belongs here.

If the question is:
“how does this feature work internally?”

it usually belongs elsewhere.

That distinction must remain hard.

---

## 11) Final rule

Users / Access exists to prevent authority, privilege, and feature gating from becoming implicit.

If access logic spreads invisibly,
security and predictability collapse.