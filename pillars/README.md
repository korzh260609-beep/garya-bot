# README.md — Pillars Entry Point

Purpose:
- Provide one canonical entry point into the `pillars/` system.
- Explain what `pillars/` is, what to read first, and where different kinds of truth live.
- Reduce confusion for humans and AI tools entering the project.

Status: CANONICAL
Scope: all documentation under `pillars/`

Current root rule:
- `pillars/DECISIONS.md` is the upper philosophical and architectural foundation for SG.
- All other pillar files must be interpreted through the new SG philosophy fixed in `DECISIONS.md`.
- If another pillar contradicts `DECISIONS.md`, that pillar must be corrected.

---

## 0) What `pillars/` is

`pillars/` is the canonical project documentation system for SG.

It is not:
- an archive
- a random notes folder
- a dump of ideas
- a substitute for the repository
- a replacement for SG itself

It is:
- the documented control system of the project
- the place where rules, boundaries, flows, and accepted decisions are fixed
- the main anti-guessing layer for future work
- the alignment layer that keeps implementation close to the intended SG philosophy

---

## 1) Why `pillars/` exists

The project evolves.

Without a canonical doc system, the same problems appear repeatedly:

- architecture drifts
- modules blur together
- old assumptions survive too long
- AI tools guess instead of following boundaries
- humans forget why earlier decisions were made
- the current bot implementation starts being mistaken for the full SG vision

`pillars/` exists to reduce that.

Main goal:
- make future work cheaper
- make mistakes earlier
- reduce wrong changes
- preserve architecture and governance
- keep SG aligned with the monarch's intended philosophy

---

## 2) Source hierarchy

When information conflicts, the hierarchy is:

1. verified repository/runtime reality for factual implementation state
2. `pillars/DECISIONS.md` as the upper philosophical and architectural root
3. canonical pillars interpreted through `DECISIONS.md`
4. project memory / bounded working context
5. ordinary memory / chat-derived supporting context
6. temporary chat discussion

Important rule:
- lower layers must not silently override higher layers
- runtime reality shows what currently exists, but it does not redefine what SG is meant to become

Examples:
- chat does not override pillars
- project memory does not override canonical architecture rules
- convenience does not override documented governance
- deprecated repo maps do not override RepoStateAgent/source policy
- old command-based behavior does not override the new SG philosophy in `DECISIONS.md`

---

## 3) What belongs in `pillars/`

`pillars/` should contain:

- accepted rules
- accepted decisions
- workflow order
- repository structure map
- module boundaries
- contracts
- risks
- data-flow map
- permissions map
- documentation governance rules
- philosophy and implementation boundaries that future work depends on

`pillars/` should NOT contain:

- speculative idea dumps in canonical files
- random one-off notes without ownership
- duplicated truth across many files without reason
- implementation trivia that belongs only in code/comments
- uncontrolled temporary drafts mixed with canonical docs
- old assumptions preserved as truth after `DECISIONS.md` has replaced them

---

## 4) Main file groups

### 4.1 Root-level canonical files

#### `pillars/DECISIONS.md`
Use for:
- final accepted architectural/system decisions
- non-negotiable rules
- explicit fixation of important choices
- the single root decisions file for global SG decisions
- the upper SG philosophy that all other pillars must follow

Important:
- `pillars/DECISIONS.md` is the first conceptual source to check after factual repo/runtime reality.
- `pillars/decisions/` is not an active root decisions folder.
- Deleted decision-extension files must not be referenced as current truth.
- New global decisions are discussed first, then added to `pillars/DECISIONS.md` only after explicit monarch approval.

#### `pillars/SG_ENTITY.md`
Use for:
- what SG is as a system entity
- SG as the global project entity
- relation between SG and components/tools/interfaces
- SG project experience and continuity

#### `pillars/PROJECT.md`
Use for:
- high-level project identity
- project framing
- broad strategic context
- relationship between SG, Kingdom GARYA, users, sources, memory, and scaling

#### `pillars/SG_BEHAVIOR.md`
Use for:
- SG behavior rules
- interaction style constraints
- assistant-side behavior boundaries
- meaning-first / source-first behavior
- entity-aware behavior rules

#### Workflow files under `pillars/`
Use for:
- active development order
- stage gates
- allowed/forbidden-by-stage rules
- factual notes about what is already verified

Important:
- Do not assume an old flat `WORKFLOW.md` is the active workflow source.
- If workflow is split into folder/files, use the active workflow structure, not archived files.
- Archived workflow files must not be treated as current stage truth.
- Workflow must describe the path toward the intended SG, not freeze the project inside the current bot implementation.

#### `pillars/REPOINDEX.md`
Use for:
- legacy/supportive repository map only if marked current
- responsibility zones
- core boundaries
- repository structure understanding

Important:
- If `REPOINDEX.md` is marked legacy/deprecated, it must not be used as factual current repo state.
- Current repo/project factual state must follow `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`.

#### `pillars/CODE_OUTPUT.md`
Use for:
- code-output policy
- output formatting/delivery rules
- code-related response behavior

#### `pillars/DOCS_GOVERNANCE.md`
Use for:
- how pillars must be maintained
- when docs must be updated
- how stale docs are treated
- living-documentation rules

---

### 4.2 Architecture files

Located under:

`pillars/architecture/`

Entry file:

#### `pillars/architecture/README.md`
Use for:
- architecture reading order
- cross-pillar alignment
- active architecture map
- Human Mode / Technical Mode / capability / source guardrails

Current architecture-level files include:

#### `SG_INTERFACE_LAYERS.md`
Use for:
- Human Mode vs Technical Mode separation
- no mixing rule
- interface modes as components of SG

#### `SEMANTIC_ROUTING.md`
Use for:
- meaning-first routing principle
- semantic routing as a minimal controller/gate layer
- explicit rule that routing must not replace reasoning model intelligence
- Technical Mode legacy/command boundary

#### `HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
Use for:
- Human Mode repo/project-work skeleton
- gated meaning provider contract
- gated RepoStateAgent runner contract
- HumanEntry pipeline contract
- current runtime connection rules

#### `REPO_MAP_SOURCE_POLICY.md`
Use for:
- factual source of current repository state
- RepoStateAgent as factual repo observation subsystem
- old RepoIndex / old maps / old snapshots as legacy only

#### `SG_CAPABILITY_ACCESS.md`
Use for:
- capability exposure through SG
- difference between capability access and SG governance authority
- Human Mode / Technical Mode capability access flows

#### `MODULE_MAP.md`
Use for:
- canonical module list
- responsibility ownership
- what each module owns / does not own

#### `DATA_FLOW.md`
Use for:
- canonical high-level data-flow paths
- module handoffs
- shortcut/bypass patterns treated as risk

#### `PERMISSIONS_MAP.md`
Use for:
- high-level access-control map
- where permission decisions belong
- permission categories and protected surfaces

#### `CODE_OWNERSHIP_MAP.md`
Use for:
- mapping logical modules to real code areas
- ownership boundaries
- legacy/shared/future code areas

---

### 4.3 Module documentation

Located under:

`pillars/modules/`

Purpose:
- local module-level documentation
- boundaries
- contracts
- risks
- meaningful local evolution

Entry file:
- `pillars/modules/MODULE_INDEX.md`

Standard per-module file set:
- `README.md`
- `CONTRACTS.md`
- `RISKS.md`
- `CHANGELOG.md`

Current documented modules include:
- memory
- transport
- users
- repo
- sources
- bot
- tasks
- logging
- project_memory
- file_intake
- ai_routing

---

## 5) What to read first

### 5.1 If you are entering the project cold
Read in this order:

1. `pillars/README.md`
2. `pillars/DECISIONS.md`
3. `pillars/SG_ENTITY.md`
4. `pillars/SG_BEHAVIOR.md`
5. `pillars/PROJECT.md`
6. active workflow files under `pillars/`
7. `pillars/architecture/README.md`
8. `pillars/modules/MODULE_INDEX.md`

This gives:
- what is already decided
- what SG is
- who/what SG is not
- how SG behaves
- what the project is
- what the active work order is
- how architecture files connect
- what modules exist

---

### 5.2 If you are changing a specific module
Read in this order:

1. `pillars/modules/<module>/README.md`
2. `pillars/modules/<module>/CONTRACTS.md`
3. `pillars/modules/<module>/RISKS.md`
4. `pillars/modules/<module>/CHANGELOG.md`
5. then relevant root/architecture files if the change affects global rules

---

### 5.3 If you are changing architecture boundaries
Read in this order:

1. `pillars/DECISIONS.md`
2. `pillars/SG_ENTITY.md`
3. active workflow files under `pillars/`
4. `pillars/architecture/README.md`
5. `pillars/architecture/SG_INTERFACE_LAYERS.md`
6. `pillars/architecture/SEMANTIC_ROUTING.md`
7. `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
8. `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
9. `pillars/architecture/SG_CAPABILITY_ACCESS.md`
10. affected module docs

---

### 5.4 If you are debugging fragile behavior
Read in this order:

1. relevant module `RISKS.md`
2. relevant module `README.md`
3. relevant module `CONTRACTS.md`
4. `pillars/DECISIONS.md`
5. `pillars/SG_BEHAVIOR.md`
6. `pillars/architecture/DATA_FLOW.md`
7. diagnostics/logging-related docs if needed

---

## 6) Canonical vs supportive docs

Important distinction:

### Canonical docs
These define accepted truth and boundaries.

Examples:
- `DECISIONS.md`
- `SG_ENTITY.md`
- `SG_BEHAVIOR.md`
- `PROJECT.md`
- active workflow files
- `DOCS_GOVERNANCE.md`
- architecture files
- module `README.md` / `CONTRACTS.md` / `RISKS.md` / `CHANGELOG.md`

### Supportive docs/context
These help future work but do not override canonical truth.

Examples:
- project memory
- bounded working summaries
- task-specific notes outside canonical docs
- chat explanations
- archived workflow files
- deprecated repo maps

Rule:
- supportive docs help
- canonical docs govern
- `DECISIONS.md` governs the philosophy and global boundaries of all canonical docs

---

## 7) Anti-chaos rules

The following patterns are dangerous:

- adding new pillar files without clear ownership
- documenting the same truth in many places
- creating module folders for tiny temporary ideas
- mixing global rules with local module details
- leaving canonical docs stale after meaningful changes
- using chat as if it were a source of truth
- treating archived workflow files as current workflow truth
- treating old RepoIndex / old maps as current repo facts
- treating a component/tool/mode/agent as SG itself
- treating capability access as authority to redefine SG
- building a heavy router that duplicates reasoning model intelligence
- treating semantic routing as a separate SG brain instead of a minimal controller/gate layer
- preserving old command/regex logic as if it were Human Mode intelligence
- referencing deleted `pillars/decisions/` files as active truth

If a file does not clearly belong somewhere,
do not add it blindly.

---

## 8) Update rule

`pillars/` is a living documentation system.

That means:

- meaningful code/architecture/module changes require doc updates
- stale docs are a real project issue
- module docs must evolve with the module
- root docs must evolve when global rules or structure change
- old pillar wording must be corrected when it contradicts `DECISIONS.md`

Primary reference for documentation maintenance:
- `pillars/DOCS_GOVERNANCE.md`

---

## 9) What not to overdo

More docs is not automatically better.

The point is not to document everything.

The point is to document what future work depends on:

- boundaries
- invariants
- contracts
- risks
- ownership
- accepted decisions
- flow shape
- permission shape
- SG philosophy and component identity

When docs grow without discipline,
they become another source of confusion.

---

## 10) Recommended working discipline

Before meaningful work:

1. read `pillars/DECISIONS.md` and the relevant pillars first
2. check whether docs still match repo/runtime reality
3. do the work
4. update docs in the same work block if needed

Preferred mindset:
- first understand the SG philosophy and boundaries
- then change code/docs
- then re-check consistency

---

## 11) Final rule

`pillars/` exists so SG does not depend on memory, guesswork, or accidental continuity.

If this folder remains:
- current
- bounded
- structured
- canonical
- aligned with `DECISIONS.md`

then future humans and AI tools can work with the project much more safely.

If it becomes stale or chaotic,
it will turn from protection into a liability.