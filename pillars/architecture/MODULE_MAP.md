# MODULE_MAP.md — SG Module Map

Purpose:
- Define the canonical logical modules of SG.
- Show where responsibilities belong.
- Reduce confusion between workflow stages and module boundaries.

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

This file is not a roadmap and not a directory dump.

---

## 1) Canonical module list

Current canonical modules for SG:

1. Transport
2. Bot
3. Users / Access
4. Memory
5. Tasks
6. Sources
7. Repo
8. Logging / Diagnostics
9. Project Memory
10. File-Intake
11. AI Routing / Model Control

Not every module is equally mature in runtime.
But these are the canonical responsibility domains.

---

## 2) Module descriptions

### 2.1 Transport
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

### 2.2 Bot
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

### 2.3 Users / Access
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

### 2.4 Memory
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

### 2.5 Tasks
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

### 2.6 Sources
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

### 2.7 Repo
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

### 2.8 Logging / Diagnostics
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

### 2.9 Project Memory
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

### 2.10 File-Intake
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

### 2.11 AI Routing / Model Control
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

## 3) Dependency direction (high-level)

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

## 4) Workflow vs modules

Important distinction:

- `WORKFLOW.md` = when something is built
- `MODULE_MAP.md` = where responsibility belongs

Do not confuse stage order with module ownership.

Example:
- Memory may appear in several workflow stages
- but it is still one logical module with one responsibility domain

---

## 5) Module documentation requirement

Each canonical module should eventually have a folder under:

`pillars/modules/<module>/`

Recommended minimum:
- `README.md`
- `CONTRACTS.md`
- `RISKS.md`
- `CHANGELOG.md`

First module to use as reference:
- `pillars/modules/memory/`

---

## 6) Anti-chaos rule

Do NOT create pillar folders by:
- every workflow step
- every tiny command
- every temporary experiment

Create module docs by stable responsibility domain.

Otherwise documentation becomes fragmented and misleading.

---

## 7) Final rule

SG must evolve by modules, not by documentation chaos.

The purpose of this map is to keep future code and future AI work aligned with stable ownership boundaries.