# Project Memory Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Project Memory module.
- Fix the project-context persistence and restoration boundary.
- Keep project continuity aligned with `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: Project Memory logical interfaces

---

## 0) Contract philosophy

Project Memory contracts define how project-specific persistent context is stored and restored.

Project Memory is a continuity layer for project work.
It is not SG itself, not SG brain, not repository truth, and not canonical governance.

Canonical hierarchy:

```text
DECISIONS.md / pillars = canonical project truth
repo/runtime/source verification = factual current state
Project Memory = working project continuity context
Memory = confirmed user/system semantic context
Chat History = raw conversation archive
```

Project Memory may help SG resume work coherently.
It must not replace accepted decisions, pillars, verified repo state, source-first checks, or monarch approval.

This file does not require exact current implementation names.
It defines the contract shape that future project-memory work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

Project-context persistence must go through an explicit project-memory boundary.

Canonical logical capabilities may include:

- read project section
- write/update project section
- restore project context
- load project-scoped continuity state
- detect conflicts between stored project context and canonical sources

The exact file/function names may evolve.
The project-memory boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `getProjectSection(key, ...)`
Purpose:
- retrieve one bounded project-context section

Expected input:
- explicit section key/project scope
- optional bounded retrieval metadata

Preconditions:
- section identity is explicit enough
- caller is in a valid project-context flow
- project scope is allowed for the current user/context

Postconditions:
- returns project section or explicit absence/failure
- project-scoped context remains retrievable in structured form

Must NOT do:
- silently widen into uncontrolled project dump
- blur section identity
- leak one project/user context into another

---

### 2.2 `upsertProjectSection(key, value, ...)`
Purpose:
- create or update one bounded project-context section

Expected input:
- explicit section key
- structured bounded value/payload
- optional metadata/versioning context

Preconditions:
- section identity is explicit
- value is bounded and valid enough to store
- write path is allowed by policy/workflow
- value does not attempt to override canonical pillars silently

Postconditions:
- project section is created/updated or controlled failure occurs
- project continuity remains reviewable

Must NOT do:
- store uncontrolled garbage by convenience
- silently override canonical pillar rules
- persist architectural decisions that belong in `DECISIONS.md` / pillars only

---

### 2.3 `restoreProjectContext(scope, ...)`
Purpose:
- produce bounded project context for continuity/restoration

Expected input:
- explicit project scope
- optional retrieval hints/limits

Preconditions:
- scope is explicit enough
- restoration is requested in a real project-aware flow
- restored content does not outrank canonical sources

Postconditions:
- returns bounded project continuity context
- restored result is useful but not uncontrolled
- conflicts with canonical sources are visible where detected

Must NOT do:
- dump all stored project context blindly
- pretend project memory is equal to canonical governance
- hide stale/conflicting project state

---

### 2.4 `loadProjectState(...)`
Purpose:
- load current project-scoped state for active workflow/session usage

Expected input:
- project/session/scope metadata as applicable

Preconditions:
- target project context is explicit enough

Postconditions:
- returns current project-scoped state in reviewable form
- helps future work resume coherently

Must NOT do:
- mutate project state silently under read-oriented operation
- merge unrelated memory layers invisibly
- treat project state as verified repo/runtime state unless verification occurred

---

## 3) Caller obligations

Any caller using Project Memory must:

- use explicit project section/scope identity
- keep stored values bounded and structured
- distinguish project continuity from canonical rules
- avoid using project memory as a garbage bucket
- verify repo/runtime/source facts when factual accuracy matters

Caller must NOT:
- override pillars through project-memory writes
- treat ordinary memory/chat history as interchangeable with project memory
- assume all project context should be restored every time
- use Gary's project memory as default context for other users

---

## 4) Side effects

Project Memory operations may have side effects such as:

- project section persistence
- restoration summaries
- project-context loader results
- project-scoped observability hooks

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

Project Memory operations should fail in a controlled way when:

- section key/scope is invalid
- value is malformed or too large
- project context is unavailable
- restoration scope is ambiguous
- write path is not allowed
- stored context conflicts with canonical sources and cannot be safely resolved

Preferred behavior:
- explicit failure or absence
- bounded restoration
- visible conflict/staleness when detected
- no silent canonical-rule override

Forbidden behavior:
- uncontrolled project dumps
- hidden replacement of pillars
- silent mixing of project memory with unrelated storage layers
- confident restoration of stale project facts as current truth

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- storing canonical governance rules only in Project Memory
- using project memory as random free-form dump by default
- blindly restoring all project data into every future context
- mixing project memory invisibly with ordinary chat memory
- treating project-memory convenience as permission to bypass pillars
- treating Project Memory as SG itself or as final architectural authority
- applying project-memory context to unrelated users/projects by default

---

## 7) Future contract expansion

Future additions may include contracts for:

- project section versioning
- structured project restoration bundles
- project-state diagnostics
- project memory compaction/cleanup
- project-context loaders by role/scope
- conflict checks against pillars/repo/runtime

These additions must preserve the same principles:
- explicit
- bounded
- structured
- subordinate to canonical pillars
- source-first where factual state matters

---

## 8) Final rule

Project Memory contracts exist so SG can continue project work coherently without losing source hierarchy.

If project memory stops respecting pillar primacy,
the project context becomes ambiguous.

Project Memory restores working context; it does not decide truth.