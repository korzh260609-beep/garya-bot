# Users Module — README

Purpose:
- Define the Users / Access module as a stable responsibility domain.
- Fix what belongs to identity, roles, permissions, and access flow.
- Prevent access logic from scattering across the system.
- Keep permissions aligned with the controlled-action philosophy from `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: Users / Access logical module

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/architecture/PERMISSIONS_MAP.md`
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Module purpose

The Users / Access module is responsible for:

- identifying users
- resolving effective roles
- enforcing permissions/gates
- handling access-related flows
- protecting privileged operations
- protecting private/user/project scopes

This module exists to keep “who can do what/access” explicit and centralized.

Users / Access is not SG itself and does not own SG philosophy.

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
- action-type permission checks

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
- SG identity, architecture, philosophy, or accepted decisions

Also out of scope:
- hidden permission rules scattered inside handlers or adapters
- project governance decisions about architecture
- treating access to a component as authority to redefine SG

---

## 3) Core idea

Users / Access must answer questions like:

- who is this user?
- what effective role do they have?
- may they perform or access this action/surface/data?
- should access be denied, allowed, escalated, or require confirmation?

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
7. distinguishing action/data protection from SG thinking

---

## 5) Hard invariants

The following invariants must hold:

- privileged actions must pass explicit access checks
- access rules must not be scattered ad hoc across modules
- role logic must remain reviewable and traceable
- handlers must not silently invent access exceptions
- transport must not replace the access layer
- access policy must remain explicit, not “implied by context”
- private/user/project scope must not leak across users
- access decisions must not redefine SG identity/governance

---

## 6) Controlled-action rule

Permissions protect:

```text
actions
data
scope
surfaces
private contexts
external operations
costly operations
```

Permissions do NOT block:

```text
SG thinking
analysis
explanation
comparison
non-applied planning
```

Action types to preserve:

```text
read-only
analysis-only
prepare-only
state-changing
external-action
private-data
expensive/costly
```

State-changing, external, private-data and expensive/costly actions require stronger gates, logging, and/or confirmation where configured.

---

## 7) Relationship to identity

Users / Access is closely related to identity,
but identity link mechanics and access policy are not the same thing.

Identity answers:
- who is this across platforms?

Access answers:
- what are they allowed to do or access?

These may interact, but must not be conflated.

---

## 8) Relationship to adjacent modules

Users / Access is closely related to:

- Transport
- Bot
- Memory
- Tasks
- Sources
- Repo
- Logging / Diagnostics
- Minimal Controller / Gate boundary

But this module does not own their internal logic.

It only owns access decisions about actions/data/surfaces touching them.

---

## 9) Examples of what Users / Access may do

Allowed examples:

- determine whether current user is monarch/guest/citizen/etc.
- allow or deny admin command usage
- restrict sensitive repo operations
- enforce role-based feature limits
- record access requests and decisions
- expose centralized `can(...)` logic
- block protected actions while still allowing explanation or prepare-only plan

These are access responsibilities.

---

## 10) Examples of what Users / Access must not do

Forbidden examples:

- implement full business feature logic
- decide memory content meaning
- fetch external source payloads itself
- parse platform payloads like a transport adapter
- route AI models
- become a generic “misc util” module
- prevent safe analysis merely because mutation is denied
- grant governance authority because someone can use a feature

These blur boundaries and create hidden coupling.

---

## 11) Ownership rule

If the question is:
“is this user allowed to do/access this action/data/surface?”

it belongs here.

If the question is:
“how does this feature work internally?”

it usually belongs elsewhere.

If the question is:
“what is SG or what is SG allowed to become?”

it belongs to `DECISIONS.md` and root pillars, not this module.

---

## 12) Final rule

Users / Access exists to prevent authority, privilege, and feature gating from becoming implicit.

If access logic spreads invisibly,
security and predictability collapse.

If permissions start blocking SG thinking instead of controlled actions/data,
the philosophy is wrong.