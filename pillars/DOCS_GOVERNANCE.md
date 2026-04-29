# DOCS_GOVERNANCE.md — Pillars Documentation Governance

Purpose:
- Define how project documentation in `pillars/` must be maintained.
- Prevent stale context, contradictory docs, and AI guessing.
- Make project knowledge explicit, reviewable, and current.

Status: CANONICAL
Scope: all files under `pillars/`

This document must be interpreted together with:
- `pillars/README.md`
- `pillars/SG_ENTITY.md`
- `pillars/decisions/README.md`
- `pillars/architecture/README.md`

---

## 0) Core principle

`pillars/` is NOT an archive.

`pillars/` is a mandatory living documentation system for SG.

Any meaningful evolution of the project must be reflected in the relevant pillar file(s).

If code changes but pillars are not updated, project context becomes stale and unsafe.

---

## 1) Hard rule

Any meaningful change affecting one or more of the following:

- SG identity / entity definition
- architecture
- module boundaries
- contracts
- permissions
- behavior
- workflow order
- repository structure
- safety rules
- operational commands
- data model / storage responsibilities
- accepted decisions
- source-of-truth policy
- Human Mode / Technical Mode boundaries
- component identity and ownership

MUST be reflected in the corresponding pillar file
in the same work block or immediately after it.

---

## 2) Invalid state

The following state is invalid:

- repository/runtime behavior changed
- but related pillar files were not updated

This means:
- documentation is stale
- AI context is partially false
- future code generation becomes less reliable
- review quality drops

Such divergence must be treated as a real project issue.

---

## 3) Source hierarchy

Priority of truth:

1. Runtime / repository actual state
2. Pillars as canonical documented truth
3. Active accepted decision files
4. Project memory / bounded working context
5. Chat discussion / temporary explanations

Rules:
- Chat never overrides pillars
- Archived files do not override active pillars
- Project memory does not override accepted decisions
- Pillars must converge toward verified repository/runtime reality
- If divergence is found, it must be fixed explicitly

---

## 4) File responsibility map

### 4.1 Global files

#### `pillars/README.md`
Use for:
- entry point into the pillars system
- reading order
- source hierarchy
- file group map
- anti-chaos rules

#### `pillars/SG_ENTITY.md`
Use for:
- what SG is as a system entity
- SG as the global project entity
- relation between SG and components/tools/interfaces
- SG project experience and continuity

Do NOT use for:
- local implementation details
- stage-specific task lists
- module-local contracts

#### `pillars/PROJECT.md`
Use for:
- high-level project identity
- mission / product framing
- major strategic context
- SG relationship with Kingdom GARYA, users, memory, sources and scaling

#### `pillars/SG_BEHAVIOR.md`
Use for:
- assistant behavior rules
- interaction norms
- communication constraints
- meaning-first / source-first behavior
- entity-aware behavior rules

#### `pillars/DECISIONS.md`
Use for:
- final accepted global decisions
- non-negotiable architectural/system rules
- high-level policy fixation

Do NOT use for:
- module-local implementation trivia
- temporary ideas
- TODOs
- drafts

#### `pillars/decisions/`
Use for:
- accepted decision extensions
- small active decision files that are safer to review separately than editing the large `DECISIONS.md`

Rules:
- files here must not be drafts
- accepted files must include `Status: ACCEPTED`
- this folder must have an index at `pillars/decisions/README.md`
- conflicts with `pillars/DECISIONS.md` must be resolved explicitly

#### Active workflow files under `pillars/`
Use for:
- development order
- stage gates
- allowed / forbidden-by-stage behavior
- factual execution notes

Important:
- Do not assume an old flat `pillars/WORKFLOW.md` is the active workflow source.
- If workflow is split into folder/files, use the active workflow structure.
- Archived workflow files must not be treated as current stage truth.

#### `pillars/REPOINDEX.md`
Use for:
- repository map only if it is explicitly marked current
- structural boundaries
- core zones
- responsibility areas
- critical files / blast radius

Important:
- If `REPOINDEX.md` is marked legacy/deprecated, it must not be used as factual current repo state.
- Current factual repository state must follow `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`.

#### `pillars/CODE_OUTPUT.md`
Use for:
- code-output policy
- output modes
- formatting / delivery rules for code work

---

### 4.2 Architecture files

Located under:

`pillars/architecture/`

Required entry file:
- `pillars/architecture/README.md`

Use architecture docs for:
- global technical boundaries
- interface modes
- source-of-truth policies
- data flow
- permission maps
- module maps
- skeleton contracts
- guardrails for future implementation

Architecture files must preserve:

```text
SG = global project entity
components = organs / channels / instruments / subsystems of SG
external AI operators = temporary helpers, not SG itself
```

---

## 5) Module documentation rules

Each major module under `pillars/modules/<module>/` should contain its own local documentation set.

Recommended files:

- `README.md`
- `CONTRACTS.md`
- `RISKS.md`
- `CHANGELOG.md`
- optional local `DECISIONS.md`

### 5.1 `README.md`
Purpose:
- define module purpose
- scope / out-of-scope
- boundaries
- dependencies
- invariants

### 5.2 `CONTRACTS.md`
Purpose:
- define public interfaces
- input/output expectations
- preconditions
- postconditions
- side effects
- error behavior

### 5.3 `RISKS.md`
Purpose:
- define likely failure modes
- dangerous assumptions
- regression risks
- verification points

### 5.4 `CHANGELOG.md`
Purpose:
- track meaningful module evolution
- record behavior changes that matter for future work

### 5.5 local `DECISIONS.md` (optional)
Use only when:
- the module has enough local decisions
- these decisions are too detailed/noisy for global `pillars/DECISIONS.md`

Rule:
- global architectural decisions stay in root `pillars/DECISIONS.md` or accepted files under `pillars/decisions/`
- module-local accepted decisions may live in module-local `DECISIONS.md`

---

## 6) When exactly docs must be updated

Documentation update is mandatory when any of the following happens:

1. A new module appears
2. Module boundaries change
3. A new public function/contract appears
4. A permission rule changes
5. Storage responsibility changes
6. Behavior or operator flow changes
7. Commands are added, removed, or repurposed
8. Runtime limitations become known
9. A temporary implementation becomes permanent
10. A previous assumption becomes invalid
11. A new accepted decision is added
12. SG identity/entity rules change
13. Human Mode / Technical Mode boundaries change
14. Source-of-truth policy changes
15. A previously active doc becomes archived/deprecated

---

## 7) Change procedure

For meaningful work blocks:

1. Read relevant pillar files first
2. Check if they still match repository/runtime state
3. Perform the code/document change
4. Update the relevant pillar file(s)
5. Treat documentation update as part of completion

Recommended order:
- module docs first for local changes
- architecture docs for global technical boundary changes
- root pillars if the change affects system-level rules
- decision files when an architectural/system decision is accepted

---

## 8) AI work rule

Before serious AI/code work, the operator or AI must:

1. read relevant root pillars
2. read relevant architecture docs
3. read relevant module docs
4. verify that the planned work does not contradict accepted decisions
5. flag stale documentation when detected

AI must not silently “guess around” missing or stale pillar context.

If critical ambiguity exists, it should be surfaced explicitly.

AI must not treat:
- archived workflow files as current workflow truth
- old RepoIndex as current repo state
- external AI tools as SG itself
- Human Mode / Technical Mode / RepoStateAgent as separate SG entities

---

## 9) Minimal quality standard for pillar docs

Pillar files must prefer:

- explicit boundaries
- clear invariants
- accepted decisions
- concrete responsibilities
- non-ambiguous wording
- current source-of-truth declarations
- clear relation between global SG entity and its components

Avoid:

- vague motivational text
- duplicate statements across many files
- hidden assumptions
- large mixed-purpose files
- speculative notes in canonical files
- stale references to archived docs as active truth

---

## 10) Definition of “meaningful change”

A change is meaningful if it affects at least one of:

- what the system does
- what SG is or is not
- where responsibility lives
- who can do something
- how data flows
- what must not be broken
- how future code should be written
- how future AI operators should understand the project

If yes — docs must be updated.

---

## 11) Practical maintenance rule

Do not try to document everything.

Document what future work depends on:

- boundaries
- contracts
- invariants
- permissions
- risks
- accepted decisions
- source-of-truth policy
- component ownership
- SG entity integrity

The goal is not “more docs”.
The goal is “less guessing and fewer wrong changes”.

---

## 12) Final rule

Pillars exist to keep SG predictable while the project evolves.

If the project evolves but pillars do not,
then pillars stop being a control system
and become a source of false confidence.

That is forbidden.