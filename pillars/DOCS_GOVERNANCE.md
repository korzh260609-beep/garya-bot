# DOCS_GOVERNANCE.md — Pillars Documentation Governance

Purpose:
- Define how project documentation in `pillars/` must be maintained.
- Prevent stale context, contradictory docs, and AI guessing.
- Make project knowledge explicit, reviewable, and current.

Status: CANONICAL
Scope: all files under `pillars/`

---

## 0) Core principle

`pillars/` is NOT an archive.

`pillars/` is a mandatory living documentation system for SG.

Any meaningful evolution of the project must be reflected in the relevant pillar file(s).

If code changes but pillars are not updated, project context becomes stale and unsafe.

---

## 1) Hard rule

Any meaningful change affecting one or more of the following:

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
3. Chat discussion / temporary explanations

Rules:
- Chat never overrides pillars
- Pillars must converge toward verified repository/runtime reality
- If divergence is found, it must be fixed explicitly

---

## 4) File responsibility map

### 4.1 Global files

#### `pillars/WORKFLOW.md`
Use for:
- development order
- stage gates
- allowed / forbidden-by-stage behavior
- factual execution notes

Do NOT use for:
- local module contracts
- speculative design dumps
- detailed technical internals of one module

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

#### `pillars/REPOINDEX.md`
Use for:
- repository map
- structural boundaries
- core zones
- responsibility areas
- critical files / blast radius

Do NOT use for:
- workflow order
- speculative future architecture
- local module decision history

#### `pillars/PROJECT.md`
Use for:
- high-level project identity
- mission / product framing
- major strategic context

#### `pillars/SG_BEHAVIOR.md`
Use for:
- assistant behavior rules
- interaction norms
- communication constraints

#### `pillars/CODE_OUTPUT.md`
Use for:
- code-output policy
- output modes
- formatting / delivery rules for code work

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
- global architectural decisions stay in root `pillars/DECISIONS.md`
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
- root pillars if the change affects system-level rules

---

## 8) AI work rule

Before serious AI/code work, the operator or AI must:

1. read relevant root pillars
2. read relevant module docs
3. verify that the planned work does not contradict accepted decisions
4. flag stale documentation when detected

AI must not silently “guess around” missing or stale pillar context.

If critical ambiguity exists, it should be surfaced explicitly.

---

## 9) Minimal quality standard for pillar docs

Pillar files must prefer:

- explicit boundaries
- clear invariants
- accepted decisions
- concrete responsibilities
- non-ambiguous wording

Avoid:

- vague motivational text
- duplicate statements across many files
- hidden assumptions
- large mixed-purpose files
- speculative notes in canonical files

---

## 10) Definition of “meaningful change”

A change is meaningful if it affects at least one of:

- what the system does
- where responsibility lives
- who can do something
- how data flows
- what must not be broken
- how future code should be written

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

The goal is not “more docs”.
The goal is “less guessing and fewer wrong changes”.

---

## 12) Final rule

Pillars exist to keep SG predictable while the project evolves.

If the project evolves but pillars do not,
then pillars stop being a control system
and become a source of false confidence.

That is forbidden.