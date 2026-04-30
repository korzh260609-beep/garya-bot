# DOCS_GOVERNANCE.md — Pillars Documentation Governance

Purpose:
- Define how project documentation in `pillars/` must be maintained.
- Prevent stale context, contradictory docs, and AI guessing.
- Make project knowledge explicit, reviewable, and current.
- Keep all pillar documentation aligned with the new SG philosophy fixed in `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: all files under `pillars/`

This document must be interpreted together with:
- `pillars/DECISIONS.md`
- `pillars/README.md`
- `pillars/SG_ENTITY.md`
- `pillars/architecture/README.md`

Important:
- `pillars/DECISIONS.md` is the single root decisions file.
- `pillars/DECISIONS.md` is the upper philosophical and architectural foundation for SG.
- `pillars/decisions/` is not an active root decisions folder.
- Deleted decision-extension files must not be referenced as active truth.

---

## 0) Core principle

`pillars/` is NOT an archive.

`pillars/` is a mandatory living documentation system for SG.

Any meaningful evolution of the project must be reflected in the relevant pillar file(s).

If code changes but pillars are not updated, project context becomes stale and unsafe.

If SG philosophy changes but pillars are not aligned, documentation becomes misleading even if it still describes the old runtime correctly.

---

## 1) Hard rule

Any meaningful change affecting one or more of the following:

- SG identity / entity definition
- SG philosophy
- personal SG model
- controlled action boundaries
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
- semantic routing boundaries
- minimal controller / gate boundaries
- capability access boundaries
- component identity and ownership

MUST be reflected in the corresponding pillar file
in the same work block or immediately after it.

---

## 2) Invalid state

The following state is invalid:

- repository/runtime behavior changed
- but related pillar files were not updated

The following state is also invalid:

- `pillars/DECISIONS.md` changes SG philosophy or global rules
- but related root, architecture, workflow, or module docs still preserve the old logic as current truth

This means:
- documentation is stale
- AI context is partially false
- future code generation becomes less reliable
- review quality drops
- old bot/runtime assumptions can be mistaken for the intended SG vision

Such divergence must be treated as a real project issue.

---

## 3) Source hierarchy

Priority of truth must distinguish current facts from intended philosophy.

### 3.1 Factual implementation state

For what currently exists in code/runtime:

1. Runtime / repository actual state
2. RepoStateAgent / verified repo observation, where available
3. Active architecture/module docs
4. Project memory / bounded working context
5. Chat discussion / temporary explanations

### 3.2 Philosophical and architectural direction

For what SG is meant to be and how the system must evolve:

1. `pillars/DECISIONS.md`
2. `pillars/SG_ENTITY.md`
3. `pillars/PROJECT.md`
4. `pillars/SG_BEHAVIOR.md`
5. Active architecture/workflow/module docs aligned with the above
6. Project memory / bounded working context
7. Chat discussion / temporary explanations

Rules:
- Chat never overrides pillars
- Archived files do not override active pillars
- Project memory does not override accepted decisions
- Runtime reality shows what exists now, but it does not redefine SG philosophy
- Pillars must converge toward verified repository/runtime reality for factual state
- Pillars must converge toward `DECISIONS.md` for philosophy and global boundaries
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

#### `pillars/DECISIONS.md`
Use for:
- final accepted global decisions
- non-negotiable architectural/system rules
- high-level policy fixation
- the single root decisions file for global SG decisions
- the upper philosophical and architectural foundation for SG

Do NOT use for:
- module-local implementation trivia
- temporary ideas
- TODOs
- drafts

Rules:
- new global decisions are discussed first
- new global decisions are added only after explicit monarch approval
- global decisions must be added to `pillars/DECISIONS.md`
- old/deleted `pillars/decisions/` files must not be referenced as active truth

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
- controlled action boundaries

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
- Workflow must describe the route toward the intended SG, not freeze the project inside the current Telegram/runtime implementation.

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
- semantic routing principles and gates
- minimal controller boundaries
- capability access rules
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
routing/controller = minimal protection layer, not SG brain
```

Current sensitive architecture docs include:
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/SEMANTIC_ROUTING.md`
- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`

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
- module-local decisions must not override root `pillars/DECISIONS.md`

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
13. SG philosophy changes
14. Personal SG / multi-user identity rules change
15. Controlled action boundaries change
16. Human Mode / Technical Mode boundaries change
17. Source-of-truth policy changes
18. A previously active doc becomes archived/deprecated
19. Semantic routing / minimal controller gate changes
20. Capability access/governance boundary changes

---

## 7) Change procedure

For meaningful work blocks:

1. Read `pillars/DECISIONS.md` first for global philosophy and accepted decisions
2. Read relevant pillar files
3. Check if they still match repository/runtime state and SG philosophy
4. Perform the code/document change
5. Update the relevant pillar file(s)
6. Treat documentation update as part of completion

Recommended order:
- module docs first for local changes
- architecture docs for global technical boundary changes
- root pillars if the change affects system-level rules
- `pillars/DECISIONS.md` when a global architectural/system decision is accepted

---

## 8) AI work rule

Before serious AI/code work, the operator or AI must:

1. read `pillars/DECISIONS.md`
2. read relevant root pillars
3. read relevant architecture docs
4. read relevant module docs
5. verify that the planned work does not contradict accepted decisions
6. flag stale documentation when detected

AI must not silently “guess around” missing or stale pillar context.

If critical ambiguity exists, it should be surfaced explicitly.

AI must not treat:
- archived workflow files as current workflow truth
- old RepoIndex as current repo state
- external AI tools as SG itself
- Human Mode / Technical Mode / RepoStateAgent as separate SG entities
- heavy SemanticRouter as a replacement for reasoning model intelligence
- routing/controller layer as SG’s separate brain
- capability access as authority to redefine SG
- deleted `pillars/decisions/` files as active decisions truth

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
- clear distinction between current runtime and intended SG direction

Avoid:

- vague motivational text
- duplicate statements across many files
- hidden assumptions
- large mixed-purpose files
- speculative notes in canonical files
- stale references to archived docs as active truth
- stale references to deleted decision-extension files
- describing the current bot as if it were the full intended SG

---

## 10) Definition of “meaningful change”

A change is meaningful if it affects at least one of:

- what the system does
- what SG is or is not
- SG philosophy
- personal SG / multi-user identity model
- controlled action boundaries
- where responsibility lives
- who can do something
- how data flows
- what must not be broken
- how future code should be written
- how future AI operators should understand the project
- how semantic routing/minimal controller or capability access is gated

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
- semantic routing/minimal controller gates
- capability access gates
- component ownership
- SG entity integrity
- SG philosophy
- personal SG boundaries

The goal is not “more docs”.
The goal is “less guessing and fewer wrong changes”.

---

## 12) Final rule

Pillars exist to keep SG predictable while the project evolves.

Pillars must describe both:
- what currently exists in repo/runtime;
- what SG is intended to become according to `pillars/DECISIONS.md`.

If the project evolves but pillars do not,
then pillars stop being a control system
and become a source of false confidence.

If pillars preserve old bot/runtime assumptions after `DECISIONS.md` changes the philosophy,
then pillars also become a source of false confidence.

That is forbidden.