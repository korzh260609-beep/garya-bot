# Repo Module — README

Purpose:
- Define the Repo module as a stable responsibility domain.
- Fix what belongs to repository access, indexing, and guarded file reading.
- Prevent repository tooling from becoming uncontrolled or over-privileged.

Status: CANONICAL
Scope: Repo logical module

---

## 0) Module purpose

The Repo module is responsible for:

- reading repository structure
- supporting safe repository inspection
- indexing repository metadata/content within approved limits
- guarded on-demand file access
- enabling repo diagnostics/review support

This module exists to let SG understand the repository without turning repo access into uncontrolled archival or auto-modification behavior.

---

## 1) In scope

Repo includes responsibilities such as:

- repository tree listing
- safe file fetch by path
- indexing repository structure
- limited content indexing under policy
- repository review support
- repository access filtering
- repository-related diagnostics

Typical related code areas may include:
- repo source access
- GitHub connector wrappers
- file filters
- repo snapshot/index logic
- repo review helpers

---

## 2) Out of scope

The Repo module must NOT own:

- code deployment
- code application
- auto-patching
- auto-commit/push behavior
- permission policy itself
- transport parsing
- memory semantics
- external source-fetching beyond repository scope

Also out of scope:
- acting as a full code archive in long-term memory
- bypassing governance or human approval

---

## 3) Core idea

Repo must give SG bounded repository visibility.

That means:

- enough access to inspect structure and selected files
- not enough freedom to silently expand into unsafe repository control

Repo is read/inspect first.
Not write/control first.

---

## 4) Core responsibilities

The Repo module is responsible for:

1. listing repository structure
2. fetching allowed files safely
3. enforcing path/content guards
4. building structural repo snapshots
5. supporting repo review/read-only analysis
6. preserving repository access boundaries

---

## 5) Hard invariants

The following invariants must hold:

- repo access remains read-oriented under current governance
- structural indexing is separated from full code archival
- guarded file access must remain explicit
- sensitive paths must not be exposed casually
- repo tooling must not silently escalate from reading to modifying
- repository visibility must remain policy-bounded

---

## 6) Relationship to indexing

Repo indexing is part of this module,
but indexing is not the same thing as full repository storage.

Important distinction:

- structural index = allowed
- on-demand file reading = allowed under guard
- uncontrolled full code archival = forbidden

This distinction must remain hard.

---

## 7) Relationship to adjacent modules

Repo is closely related to:

- Users / Access
- Logging / Diagnostics
- Memory
- Bot
- Code-output/review surfaces

But Repo does not own those modules.

It only owns repository-facing logic and boundaries.

---

## 8) Examples of what Repo may do

Allowed examples:

- list all repository paths
- fetch one allowed file on demand
- maintain structural repo snapshot
- filter sensitive path access
- support repo review diagnostics
- expose bounded repo search/review helpers

These are repo responsibilities.

---

## 9) Examples of what Repo must not do

Forbidden examples:

- auto-apply code changes
- silently widen access scope
- store full repository source bodies as memory archive
- bypass access/safety restrictions
- behave like a deployment engine
- treat “can read” as “can modify”

These would break governance and safety.

---

## 10) Ownership rule

If the question is:
- how to inspect repository structure
- how to fetch a file safely
- how to build repo metadata snapshot
- how to support repo review in read-only form

it belongs here.

If the question is:
- who is allowed to do it
- how generated code should be applied
- whether architecture may change

then it belongs elsewhere or must be shared with governance modules.

---

## 11) Final rule

Repo exists to make repository understanding possible without turning SG into an uncontrolled code operator.

If repo access quietly expands into write/control behavior,
the governance model is broken.