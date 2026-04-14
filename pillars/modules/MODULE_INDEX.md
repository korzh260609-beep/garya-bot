# MODULE_INDEX.md — Module Documentation Index

Purpose:
- Provide one canonical entrypoint into `pillars/modules/`.
- Show which module docs exist, what each module folder contains, and how mature each module is.
- Reduce friction when humans or AI need to find boundaries, contracts, risks, and runtime expectations quickly.

Status: CANONICAL
Scope: `pillars/modules/`

---

## 0) Why this file exists

As module documentation grows, one problem appears quickly:

- files exist
- but nobody knows where to start
- or whether a module already has docs
- or which module is actively mature in runtime
- or which file to read first

This index exists to solve that.

---

## 1) How to use this folder

When working on a module:

1. read `README.md`
2. read `CONTRACTS.md`
3. read `RISKS.md`
4. read `CHANGELOG.md`
5. read root pillars if the change affects global rules

Suggested read order:
- module local docs first
- then root `DECISIONS.md`, `WORKFLOW.md`, `REPOINDEX.md` as needed

---

## 2) Standard module file set

Expected per-module file set:

- `README.md`
- `CONTRACTS.md`
- `RISKS.md`
- `CHANGELOG.md`

Optional later:
- `DECISIONS.md`
- `TESTING.md`
- `DATA_MODEL.md`

---

## 3) Maturity labels used in this file

### `documented + active`
Meaning:
- module is documented
- module clearly exists in current runtime/code reality
- changes to this module should assume real operational impact

### `documented + partial runtime`
Meaning:
- module is documented
- some real runtime/code presence exists
- but ownership/boundaries may still be mixed, incomplete, or transitional

### `documented + future-facing`
Meaning:
- module is documented as canonical architecture
- but runtime implementation is still limited, skeletal, or mostly preparatory

Important rule:
- these maturity labels are practical guidance
- they do NOT override repository/runtime verification
- if runtime reality and this file diverge, verified repository/runtime wins and this index must be updated

---

## 4) Current module index

### 4.1 memory
Status:
- `documented + active`

Files:
- `pillars/modules/memory/README.md`
- `pillars/modules/memory/CONTRACTS.md`
- `pillars/modules/memory/RISKS.md`
- `pillars/modules/memory/CHANGELOG.md`

Purpose:
- long-term memory boundaries
- memory contracts
- memory risk model

Read together with:
- `pillars/DECISIONS.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`

---

### 4.2 transport
Status:
- `documented + partial runtime`

Files:
- `pillars/modules/transport/README.md`
- `pillars/modules/transport/CONTRACTS.md`
- `pillars/modules/transport/RISKS.md`
- `pillars/modules/transport/CHANGELOG.md`

Purpose:
- transport boundaries
- adapter-to-core discipline
- transport risk model

Read together with:
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/REPOINDEX.md`

---

### 4.3 users
Status:
- `documented + active`

Files:
- `pillars/modules/users/README.md`
- `pillars/modules/users/CONTRACTS.md`
- `pillars/modules/users/RISKS.md`
- `pillars/modules/users/CHANGELOG.md`

Purpose:
- identity/access boundaries
- permission contracts
- privilege risk model

Read together with:
- `pillars/architecture/PERMISSIONS_MAP.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/DECISIONS.md`

---

### 4.4 repo
Status:
- `documented + active`

Files:
- `pillars/modules/repo/README.md`
- `pillars/modules/repo/CONTRACTS.md`
- `pillars/modules/repo/RISKS.md`
- `pillars/modules/repo/CHANGELOG.md`

Purpose:
- repository access boundaries
- guarded repo contracts
- repo safety risk model

Read together with:
- `pillars/REPOINDEX.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/architecture/PERMISSIONS_MAP.md`

---

### 4.5 sources
Status:
- `documented + active`

Files:
- `pillars/modules/sources/README.md`
- `pillars/modules/sources/CONTRACTS.md`
- `pillars/modules/sources/RISKS.md`
- `pillars/modules/sources/CHANGELOG.md`

Purpose:
- source-fetching boundaries
- normalization contracts
- source-first risk model

Read together with:
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/DECISIONS.md`

---

### 4.6 bot
Status:
- `documented + active`

Files:
- `pillars/modules/bot/README.md`
- `pillars/modules/bot/CONTRACTS.md`
- `pillars/modules/bot/RISKS.md`
- `pillars/modules/bot/CHANGELOG.md`

Purpose:
- command/handler boundaries
- dispatch contracts
- handler bloat risk model

Read together with:
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/REPOINDEX.md`

---

### 4.7 tasks
Status:
- `documented + active`

Files:
- `pillars/modules/tasks/README.md`
- `pillars/modules/tasks/CONTRACTS.md`
- `pillars/modules/tasks/RISKS.md`
- `pillars/modules/tasks/CHANGELOG.md`

Purpose:
- task execution boundaries
- lifecycle contracts
- duplicate-run/lifecycle risk model

Read together with:
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/WORKFLOW.md`

---

### 4.8 logging
Status:
- `documented + active`

Files:
- `pillars/modules/logging/README.md`
- `pillars/modules/logging/CONTRACTS.md`
- `pillars/modules/logging/RISKS.md`
- `pillars/modules/logging/CHANGELOG.md`

Purpose:
- observability boundaries
- diagnostics contracts
- false-visibility risk model

Read together with:
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/PERMISSIONS_MAP.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`

---

### 4.9 project_memory
Status:
- `documented + partial runtime`

Files:
- `pillars/modules/project_memory/README.md`
- `pillars/modules/project_memory/CONTRACTS.md`
- `pillars/modules/project_memory/RISKS.md`
- `pillars/modules/project_memory/CHANGELOG.md`

Purpose:
- project continuity boundaries
- project context contracts
- pillar/project-memory conflict risk model

Read together with:
- `pillars/README.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`

---

### 4.10 file_intake
Status:
- `documented + future-facing`

Files:
- `pillars/modules/file_intake/README.md`
- `pillars/modules/file_intake/CONTRACTS.md`
- `pillars/modules/file_intake/RISKS.md`
- `pillars/modules/file_intake/CHANGELOG.md`

Purpose:
- file/media intake boundaries
- extraction routing contracts
- modality risk model

Read together with:
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/WORKFLOW.md`

---

### 4.11 ai_routing
Status:
- `documented + partial runtime`

Files:
- `pillars/modules/ai_routing/README.md`
- `pillars/modules/ai_routing/CONTRACTS.md`
- `pillars/modules/ai_routing/RISKS.md`
- `pillars/modules/ai_routing/CHANGELOG.md`

Purpose:
- centralized AI-call boundaries
- model routing contracts
- scattered-AI-call risk model

Read together with:
- `pillars/DECISIONS.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/CODE_OUTPUT.md`

---

## 5) Read-path guidance

### If changing architecture boundaries
Read:
- module `README.md`
- module `RISKS.md`
- root `DECISIONS.md`
- root `REPOINDEX.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`

### If changing public behavior/interface of a module
Read:
- module `CONTRACTS.md`
- module `README.md`
- module `CHANGELOG.md`

### If debugging fragile behavior
Read:
- module `RISKS.md`
- module `README.md`
- relevant diagnostics/logging docs
- `pillars/architecture/DATA_FLOW.md`

### If introducing a new module
Read:
- `pillars/DOCS_GOVERNANCE.md`
- `pillars/architecture/MODULE_MAP.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- this file
- then create new module folder with standard file set

---

## 6) Anti-chaos rule

Do NOT add random files into `pillars/modules/` without deciding:

- is this a real stable module?
- is this file canonical or temporary?
- should this be inside one module folder instead?
- does this duplicate an existing module doc?
- what maturity/status will this module realistically have?

Otherwise the module-doc system will decay quickly.

---

## 7) Maintenance rule

Whenever a new module doc folder is added, removed, or materially re-scoped,
this index must be updated in the same work block.

Whenever a module maturity changes meaningfully,
this index should also be updated.

If this file becomes stale,
discoverability and trust in the whole module-doc system degrades.

---

## 8) Final rule

`pillars/modules/` exists to reduce guessing.

`MODULE_INDEX.md` exists to reduce search cost and false confidence.

If people cannot quickly find the right module docs
or cannot tell how mature a module really is,
the system will be misread and eventually ignored.