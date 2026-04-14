# README.md — Pillars Entry Point

Purpose:
- Provide one canonical entry point into the `pillars/` system.
- Explain what `pillars/` is, what to read first, and where different kinds of truth live.
- Reduce confusion for humans and AI tools entering the project.

Status: CANONICAL
Scope: all documentation under `pillars/`

---

## 0) What `pillars/` is

`pillars/` is the canonical project documentation system for SG.

It is not:
- an archive
- a random notes folder
- a dump of ideas
- a substitute for the repository

It is:
- the documented control system of the project
- the place where rules, boundaries, flows, and accepted decisions are fixed
- the main anti-guessing layer for future work

---

## 1) Why `pillars/` exists

The project evolves.

Without a canonical doc system, the same problems appear repeatedly:

- architecture drifts
- modules blur together
- old assumptions survive too long
- AI tools guess instead of following boundaries
- humans forget why earlier decisions were made

`pillars/` exists to reduce that.

Main goal:
- make future work cheaper
- make mistakes earlier
- reduce wrong changes
- preserve architecture and governance

---

## 2) Source hierarchy

When information conflicts, the hierarchy is:

1. verified repository/runtime reality
2. canonical pillars
3. project memory / bounded working context
4. ordinary memory / chat-derived supporting context
5. temporary chat discussion

Important rule:
- lower layers must not silently override higher layers

Examples:
- chat does not override pillars
- project memory does not override canonical architecture rules
- convenience does not override documented governance

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

`pillars/` should NOT contain:

- speculative idea dumps in canonical files
- random one-off notes without ownership
- duplicated truth across many files without reason
- implementation trivia that belongs only in code/comments
- uncontrolled temporary drafts mixed with canonical docs

---

## 4) Main file groups

### 4.1 Root-level canonical files

#### `pillars/WORKFLOW.md`
Use for:
- development order
- stage gates
- allowed/forbidden-by-stage rules
- factual notes about what is already verified

#### `pillars/DECISIONS.md`
Use for:
- final accepted architectural/system decisions
- non-negotiable rules
- explicit fixation of important choices

#### `pillars/REPOINDEX.md`
Use for:
- repository map
- responsibility zones
- core boundaries
- critical files / blast radius
- repository structure understanding

#### `pillars/PROJECT.md`
Use for:
- high-level project identity
- project framing
- broad strategic context

#### `pillars/SG_BEHAVIOR.md`
Use for:
- SG behavior rules
- interaction style constraints
- assistant-side behavior boundaries

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

Current architecture-level files include:

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
2. `pillars/DOCS_GOVERNANCE.md`
3. `pillars/WORKFLOW.md`
4. `pillars/DECISIONS.md`
5. `pillars/REPOINDEX.md`
6. `pillars/architecture/MODULE_MAP.md`
7. `pillars/modules/MODULE_INDEX.md`

This gives:
- what the system is
- how docs work
- what the roadmap order is
- what is already decided
- how the repo is shaped
- what modules exist
- where to find module docs

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
2. `pillars/WORKFLOW.md`
3. `pillars/REPOINDEX.md`
4. `pillars/architecture/MODULE_MAP.md`
5. `pillars/architecture/DATA_FLOW.md`
6. `pillars/architecture/PERMISSIONS_MAP.md`
7. then affected module docs

---

### 5.4 If you are debugging fragile behavior
Read in this order:

1. relevant module `RISKS.md`
2. relevant module `README.md`
3. relevant module `CONTRACTS.md`
4. `pillars/architecture/DATA_FLOW.md`
5. diagnostics/logging-related docs if needed

---

## 6) Canonical vs supportive docs

Important distinction:

### Canonical docs
These define accepted truth and boundaries.

Examples:
- `WORKFLOW.md`
- `DECISIONS.md`
- `REPOINDEX.md`
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

Rule:
- supportive docs help
- canonical docs govern

---

## 7) Anti-chaos rules

The following patterns are dangerous:

- adding new pillar files without clear ownership
- documenting the same truth in many places
- creating module folders for tiny temporary ideas
- mixing global rules with local module details
- leaving canonical docs stale after meaningful changes
- using chat as if it were a source of truth

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

When docs grow without discipline,
they become another source of confusion.

---

## 10) Recommended working discipline

Before meaningful work:

1. read the relevant pillars first
2. check whether docs still match repo/runtime reality
3. do the work
4. update docs in the same work block if needed

Preferred mindset:
- first understand boundaries
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

then future humans and AI tools can work with the project much more safely.

If it becomes stale or chaotic,
it will turn from protection into a liability.