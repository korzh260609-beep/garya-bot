# MODULE_MAP.md — SG Module Map

Purpose:
- Define the canonical logical modules of SG.
- Show where responsibilities belong.
- Reduce confusion between workflow stages, module boundaries, and runtime maturity.
- Prevent any module, bot surface, AI router, or controller from being mistaken for SG itself.

Status: CANONICAL
Scope: repository logical architecture

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/README.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Why this file exists

Active workflow files define execution order.

Repository/runtime verification defines factual current implementation state.

RepoStateAgent is the factual source for current repository/project-map claims according to `REPO_MAP_SOURCE_POLICY.md`.

This file exists to define the stable logical module map between them:

- what modules exist
- what each module is responsible for
- what each module must NOT do
- how modules relate to each other
- how mature each module currently is conceptually

This file is not a roadmap and not a directory dump.

---

## 0.1) SG entity rule for modules

SG is the global project entity and global intellectual system.

Modules are bounded responsibility areas and components/instruments of SG.

A module must never be treated as a separate independent SG.

Correct model:

```text
SG = global project entity / global intellectual system
module = component / subsystem / responsibility domain of SG
bot = access/runtime surface, not SG itself
AI routing = model/cost wrapper, not SG brain
minimal controller/gate = action protection boundary, not separate SG brain
```

Incorrect model:

```text
module = SG itself
module = autonomous SG identity
bot = SG itself
AI router = SG brain
controller/gate = independent SG brain
module = owner of SG decisions / identity / memory / experience
```

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
- verified repository/runtime state still wins for factual implementation status
- `pillars/DECISIONS.md` still wins for SG philosophy and global direction
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

Cross-cutting architectural boundary:

- Capability / Minimal Controller / Gate Boundary — not a separate SG brain and not necessarily a standalone heavy module now.

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
- become SG identity

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
- current practical runtime access to SG

Must do:
- connect input to the right handler/service
- keep handlers small
- respect Human Mode / Technical Mode separation
- remain an access/runtime surface of SG

Must NOT do:
- become the business logic center
- perform direct storage spaghetti
- duplicate module logic
- act as SG itself
- become the default identity of SG

---

### 3.3 Users / Access
Maturity:
- `active`

Purpose:
- user identification
- role resolution
- permissions / gates
- access request flow
- action and private-data protection

Must do:
- enforce role-based restrictions
- protect privileged operations
- define who can do what
- protect user/project/private scopes
- distinguish thinking/analysis from state-changing action

Must NOT do:
- own transport logic
- own repository structure
- own memory selection logic
- override SG entity/governance rules
- restrict SG thinking when only action/private access must be restricted

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
- support SG continuity and project experience

Must NOT do:
- act as raw chat dump
- store forbidden artifacts such as raw repo source bodies
- be bypassed by handlers
- replace pillars or `pillars/DECISIONS.md`

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
- respect permissions, confirmations, and action type

Must NOT do:
- absorb unrelated module responsibilities
- contain hidden AI routing rules without explicit ownership
- act autonomously outside SG governance
- perform state-changing actions without permission

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
- replace SG reasoning or governance

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
- stay read-only in current governance unless explicit approval changes scope
- respect secret/path filtering
- preserve structural indexing rules
- follow `REPO_MAP_SOURCE_POLICY.md`

Must NOT do:
- auto-apply changes
- bypass human approval
- silently expand access scope
- present old RepoIndex / old maps as current factual repo truth
- become SG itself

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
- act as autonomous decision maker

---

### 3.9 Project Memory
Maturity:
- `partial runtime`

Purpose:
- store project-level persistent context
- support project restoration and continuity
- separate project context from user chat memory
- preserve SG project experience

Must do:
- preserve structured project knowledge
- remain distinct from ordinary dialogue memory
- remain subordinate to verified repo/runtime facts and canonical pillars

Must NOT do:
- replace canonical pillars
- become a dumping ground
- override `pillars/DECISIONS.md`

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
- bypass source-first / safety rules

---

### 3.11 AI Routing / Model Control
Maturity:
- `partial runtime`

Purpose:
- centralize model selection
- enforce model/cost policy
- preserve model-agnostic architecture
- prevent hidden direct AI calls

Must do:
- control direct AI access
- preserve cost/routing policy
- support future multi-model logic
- log model usage where applicable

Must NOT do:
- allow hidden direct model calls
- make policy decisions outside governance
- let external AI models/tools become SG itself
- become a heavy SemanticRouter
- replace reasoning model intelligence with hardcoded routing logic
- become SG brain

---

## 3.12) Capability / Minimal Controller / Gate Boundary

Status:
- cross-cutting architectural boundary, not a standalone heavy module by default

Purpose:
- protect actions
- select allowed capability path
- check permissions/scope
- check source/tool needs
- check read-only vs state-changing action type
- check risk/cost/confirmation needs

Must do:
- remain minimal
- protect state-changing and sensitive actions
- support Human Mode and Technical Mode where needed
- stay subordinate to SG philosophy and accepted decisions

Must NOT do:
- become a separate SG brain
- duplicate reasoning model thinking with large hardcoded logic
- bypass user permissions
- bypass source-first policy
- bypass confirmations for protected actions

---

## 4) Dependency direction (high-level)

Preferred high-level flow:

Transport
→ Bot
→ Users / Access
→ relevant module/service
→ Logging / Diagnostics

Human Mode control flow may include:

Human input
→ Meaning / reasoning model
→ Capability / Minimal Controller / Gate Boundary
→ relevant module/service
→ ResponseBuilder / Delivery

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
- No module may become a second SG identity
- Controller/gate must protect actions, not replace reasoning

---

## 5) Workflow vs modules

Important distinction:

- active workflow files under `pillars/workflow/` = when something is built
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
  - verified repository/runtime state
  - `pillars/DECISIONS.md` for philosophy/global direction
  - `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
  - `pillars/architecture/CODE_OWNERSHIP_MAP.md`

If old `REPOINDEX.md` is marked legacy/deprecated, it must not be used as factual current repo state.

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
- every small controller condition

Create module docs by stable responsibility domain.

Do NOT pretend all modules are equally mature if they are not.

Do NOT describe a module as SG itself.

Do NOT split minimal controller/gate into a heavy module unless a real architectural need appears and is approved.

Otherwise documentation becomes both fragmented and misleading.

---

## 9) Final rule

SG must evolve by modules, not by documentation chaos.

Modules are components of SG, not independent SG entities.

Bot, AI routing, RepoStateAgent, and controller/gate layers are not SG itself.

The purpose of this map is to keep future code and future AI work aligned with stable ownership boundaries,
while staying honest about actual runtime maturity and the intended SG philosophy.
