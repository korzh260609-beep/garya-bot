# MODULE_MAP.md — SG Module Map

Purpose:
- Define the canonical logical modules of SG.
- Show where responsibilities belong.
- Reduce confusion between workflow stages, module boundaries, and runtime maturity.

Status: CANONICAL
Scope: repository logical architecture

---

## 0) Why this file exists

`WORKFLOW.md` defines execution order.  
`REPOINDEX.md` defines repository structure and responsibility zones.

This file exists to define the stable logical module map between them:

- what modules exist
- what each module is responsible for
- what each module must NOT do
- how modules relate to each other
- how mature each module currently is conceptually

This file is not a roadmap and not a directory dump.

---

## 1) Maturity labels used in this file

### `active`
Meaning:
- module is clearly part of current runtime/code reality
- changes to this module likely have immediate operational impact

### `partial runtime`
Meaning:
- module exists conceptually and has some real runtime/code presence
- but ownership, placement, or implementation is still mixed/incomplete

### `future-facing`
Meaning:
- module is canonical in architecture
- but implementation remains mostly skeletal, limited, or preparatory

Important rule:
- these labels are architecture guidance only
- verified repository/runtime state still wins if a mismatch is found
- if mismatch is found, this file and `MODULE_INDEX.md` should be updated

---

## 2) Canonical module list

Current canonical modules for SG:

1. Transport — `partial runtime`
2. Bot — `active`
3. Users / Access — `active`
4. Memory — `active`
5. Tasks — `active`
6. Sources — `active`
7. Repo — `active`
8. Logging / Diagnostics — `active`
9. Project Memory — `partial runtime`
10. File-Intake — `future-facing`
11. AI Routing / Model Control — `partial runtime`

These are the canonical responsibility domains.

They are not equally mature in runtime.
That distinction matters.

---

## 3) Module descriptions

### 3.1 Transport
Maturity:
- `partial runtime`

Purpose:
- receive platform input
- normalize platform-specific events
- pass unified context into core flow

Must do:
- remain thin
- remain stateless
- adapt platform payloads

Must NOT do:
- business logic
- memory decisions
- permission logic
- long-term storage decisions

Examples:
- Telegram adapter
- future Discord adapter
- future web/API adapter
- future email adapter

---

### 3.2 Bot
Maturity:
- `active`

Purpose:
- command parsing
- handler dispatch
- response formatting
- conversational entry surface

Must do:
- connect input to the right handler/service
- keep handlers small

Must NOT do:
- become the business logic center
- perform direct storage spaghetti
- duplicate module logic

---

### 3.3 Users / Access
Maturity:
- `active`

Purpose:
- user identification
- role resolution
- permissions / gates
- access request flow

Must do:
- enforce role-based restrictions
- protect privileged operations
- define who can do what

Must NOT do:
- own transport logic
- own repository structure
- own memory selection logic

---

### 3.4 Memory
Maturity:
- `active`

Purpose:
- manage long-term memory
- context retrieval
- memory write/read policy
- memory dedupe and safety

Must do:
- centralize memory access
- preserve memory boundaries
- prevent uncontrolled memory pollution

Must NOT do:
- act as raw chat dump
- store forbidden artifacts such as raw repo source bodies
- be bypassed by handlers

---

### 3.5 Tasks
Maturity:
- `active`

Purpose:
- task definition
- task execution policy
- task scheduling/runtime orchestration
- task lifecycle state

Must do:
- keep execution structured and observable
- support task-oriented workflows

Must NOT do:
- absorb unrelated module responsibilities
- contain hidden AI routing rules without explicit ownership

---

### 3.6 Sources
Maturity:
- `active`

Purpose:
- fetch external/internal sources
- normalize source payloads
- manage source checks and diagnostics

Must do:
- keep provider-specific logic modular
- support source-first architecture
- make source limitations explicit

Must NOT do:
- push raw uncontrolled payloads directly into AI decisions
- hide source failures

---

### 3.7 Repo
Maturity:
- `active`

Purpose:
- repository reading
- repo structure indexing
- repo diagnostics/review support
- safe on-demand file access

Must do:
- stay read-only in current governance
- respect secret/path filtering
- preserve structural indexing rules

Must NOT do:
- auto-apply changes
- bypass human approval
- silently expand access scope

---

### 3.8 Logging / Diagnostics
Maturity:
- `active`

Purpose:
- observability
- event logging
- diagnostics support
- operational traceability

Must do:
- expose failures
- support debugging and operator review

Must NOT do:
- change business results
- become hidden control logic

---

### 3.9 Project Memory
Maturity:
- `partial runtime`

Purpose:
- store project-level persistent context
- support project restoration and continuity
- separate project context from user chat memory

Must do:
- preserve structured project knowledge
- remain distinct from ordinary dialogue memory

Must NOT do:
- replace canonical pillars
- become a dumping ground

---

### 3.10 File-Intake
Maturity:
- `future-facing`

Purpose:
- handle incoming files/media
- detect type
- route to specialized processing
- extract usable text/structure safely

Must do:
- route by modality
- preserve safe extraction boundaries

Must NOT do:
- perform uncontrolled reasoning on raw media payloads
- skip specialized routing rules

---

### 3.11 AI Routing / Model Control
Maturity:
- `partial runtime`

Purpose:
- centralize model selection
- enforce routing policy
- preserve model-agnostic architecture

Must do:
- control direct AI access
- preserve cost/routing policy
- support future multi-model logic

Must NOT do:
- allow hidden direct model calls
- make policy decisions outside governance

---

## 4) Dependency direction (high-level)

Preferred high-level flow:

Transport
→ Bot
→ Users / Access
→ relevant module/service
→ Logging / Diagnostics

Common module interactions:
- Bot may call Users / Access
- Bot may call Memory
- Bot may call Sources
- Bot may call Tasks
- Bot may call Repo
- Modules may log through Logging / Diagnostics

Hard rule:
- Transport must not become the center of system logic
- Bot handlers must not become god-objects
- Storage/policy responsibilities must remain in their owning modules

---

## 5) Workflow vs modules

Important distinction:

- `WORKFLOW.md` = when something is built
- `MODULE_MAP.md` = where responsibility belongs

Do not confuse stage order with module ownership.

Example:
- Memory may appear in several workflow stages
- but it is still one logical module with one responsibility domain

---

## 6) Runtime maturity warning

This file is not a claim that every module is already cleanly isolated in code.

Some modules are:

- active and clearly present
- partially present but still mixed
- future-facing and mostly architectural for now

Therefore:

- do not assume all modules are equally implemented
- do not treat conceptual module clarity as proof of clean runtime separation
- always cross-check with:
  - `pillars/REPOINDEX.md`
  - `pillars/architecture/CODE_OWNERSHIP_MAP.md`
  - verified repository/runtime state

---

## 7) Module documentation requirement

Each canonical module should eventually have a folder under:

`pillars/modules/<module>/`

Recommended minimum:
- `README.md`
- `CONTRACTS.md`
- `RISKS.md`
- `CHANGELOG.md`

Entry file:
- `pillars/modules/MODULE_INDEX.md`

First module to use as reference:
- `pillars/modules/memory/`

---

## 8) Anti-chaos rule

Do NOT create pillar folders by:
- every workflow step
- every tiny command
- every temporary experiment

Create module docs by stable responsibility domain.

Do NOT pretend all modules are equally mature if they are not.

Otherwise documentation becomes both fragmented and misleading.

---

## 9) Final rule

SG must evolve by modules, not by documentation chaos.

The purpose of this map is to keep future code and future AI work aligned with stable ownership boundaries,
while staying honest about actual runtime maturity.