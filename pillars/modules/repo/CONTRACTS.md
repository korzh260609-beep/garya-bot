# Repo Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Repo module.
- Fix the repository-access boundary.
- Reduce guessing during future repo tooling and review work.

Status: CANONICAL
Scope: Repo logical interfaces

---

## 0) Contract philosophy

Repo contracts define how SG may inspect repository state safely.

This file does not require exact current implementation names.
It defines the contract shape that future repo work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

Repository access must go through an explicit repo boundary.

Canonical logical capabilities may include:

- list repository files/tree
- fetch one file safely
- build repo snapshot/index
- apply repo filters/guards
- support repo review in read-only mode

The exact file/function names may evolve.
The boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `listFiles(...)`
Purpose:
- list repository structure/paths

Expected input:
- repository reference
- branch/ref if needed
- optional path scope if policy allows

Preconditions:
- repository target is explicit
- caller is within allowed repo workflow/policy

Postconditions:
- returns structural repository listing or controlled failure
- result is metadata-oriented, not uncontrolled code archival

Must NOT do:
- fetch/store unnecessary full source bodies
- silently ignore path restrictions if they exist

---

### 2.2 `fetchFile(path, ...)`
Purpose:
- fetch one specific file content under guard

Expected input:
- repository reference
- file path
- branch/ref if needed

Preconditions:
- path is explicit
- path passes traversal/sensitivity/guard checks
- caller is allowed to request this file

Postconditions:
- returns requested file content or controlled denial/failure
- access result is bounded and reviewable

Must NOT do:
- allow path traversal
- bypass sensitive-path policy
- widen access scope implicitly

---

### 2.3 `filterPath(path)`
Purpose:
- evaluate whether a path is allowed, blocked, or restricted

Expected input:
- repository path

Preconditions:
- path is explicit and normalized enough for evaluation

Postconditions:
- returns a clear allow/deny/restricted result or equivalent
- sensitive/forbidden patterns remain guarded

Must NOT do:
- silently downgrade forbidden paths to allowed
- mix unrelated policy behavior invisibly

---

### 2.4 `buildSnapshot(...)`
Purpose:
- build bounded repository snapshot/index representation

Expected input:
- repository target
- indexing scope/config
- ref/branch if needed

Preconditions:
- indexing mode is explicit
- snapshot scope is bounded by policy
- snapshot storage rules are understood

Postconditions:
- produces structural snapshot and any allowed bounded content index
- preserves distinction between metadata index and raw full-repo archival

Must NOT do:
- become uncontrolled full repository storage
- treat snapshotting as permission to store everything

---

### 2.5 `reviewRepo(...)`
Purpose:
- support read-only repository review/analysis

Expected input:
- repository target
- review scope
- optional selected files/snapshot context

Preconditions:
- review is within allowed governance stage/policy
- required repository inputs are available

Postconditions:
- returns review/analysis output in bounded advisory form
- repository remains unchanged

Must NOT do:
- mutate repository state
- auto-apply fixes
- bypass code-output governance

---

## 3) Caller obligations

Any caller using Repo must:

- go through the repo boundary
- provide explicit repository targets/paths
- respect read-only and guard policies
- distinguish between structure listing and content fetching

Caller must NOT:
- assume repo read implies repo write
- use repo access as a shortcut around governance
- bypass sensitive-path restrictions

---

## 4) Side effects

Repo operations may have side effects such as:

- snapshot persistence
- filter decisions
- bounded diagnostics/logging
- metadata caching/indexing

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

Repo operations should fail in a controlled way when:

- repository target is invalid
- path is missing or blocked
- access policy denies the request
- connector/source fails
- indexing scope is invalid
- sensitive-path rules trigger

Preferred behavior:
- explicit deny/fail result
- observable diagnostics
- no partial unsafe widening of repo access

Forbidden behavior:
- silent fallback to broader access
- hidden traversal or filter bypass
- accidental repository mutation

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- uncontrolled full repository archival under repo indexing
- bypassing sensitive-path guards
- silent expansion from read to write behavior
- treating repo review as permission to change code automatically
- storing raw full repository code in memory by default

---

## 7) Future contract expansion

Future additions may include contracts for:

- richer snapshot metadata
- guarded diff preparation
- repo diagnostics
- path classification
- limited repo search helpers
- better policy-driven fetch scopes

These additions must preserve the same principles:
- explicit
- bounded
- guard-aware
- read-oriented unless governance changes explicitly

---

## 8) Final rule

Repo contracts exist to let SG inspect code safely.

If repository access becomes broader than its documented contract,
the system becomes unsafe even before any actual code change is applied.