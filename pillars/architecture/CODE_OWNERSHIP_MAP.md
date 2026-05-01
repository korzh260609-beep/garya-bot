# CODE_OWNERSHIP_MAP.md — SG Code Ownership Map

Purpose:
- Define the canonical mapping between logical modules and real repository code areas.
- Reduce ambiguity about which files belong to which responsibility domain.
- Help humans and AI tools understand where to work and where NOT to work.
- Prevent bot, handler, router, controller, AI wrapper, or repo helper code from being mistaken for SG itself.

Status: CANONICAL
Scope: repository code ownership at a high level

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/README.md`
- `pillars/architecture/MODULE_MAP.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/PERMISSIONS_MAP.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
- `pillars/architecture/AGENT_DIRECTORY_STRUCTURE.md`
- `pillars/architecture/REPO_MAINTENANCE_AGENT_SKELETON.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Why this file exists

`MODULE_MAP.md` defines logical modules.

Verified repository/runtime state defines actual current implementation.

`REPO_MAP_SOURCE_POLICY.md` defines how current factual repository state must be established.

This file exists to connect:

- module meaning
- real code locations
- likely ownership boundaries
- legacy vs preferred placement
- controller/gate boundaries
- ownership risks around mixed files

Without this map, one common problem appears:

- docs describe modules clearly
- but nobody knows which real files are inside those modules
- or which files are legacy, mixed, or transitional

This file reduces that ambiguity.

---

## 0.1) SG entity rule for code ownership

SG is the global project entity and global intellectual system.

Code ownership means responsibility ownership inside SG.
It does not mean ownership of SG itself.

Correct model:

```text
SG = global project entity / global intellectual system
code area = implementation surface of one or more SG components
code ownership = responsibility boundary, not SG identity ownership
minimal controller/gate code = action protection boundary, not SG brain
AI routing code = model/cost wrapper, not SG brain
```

Incorrect model:

```text
file/module owner = owner of SG identity
repo tool = SG itself
external coding AI = SG itself
handler/router/controller = hidden SG brain
AI wrapper = SG brain
code ownership = permission to redefine SG architecture/governance/philosophy
```

---

## 1) Core principle

Code ownership must follow responsibility,
not convenience.

That means:

- a file belongs to the module whose responsibility it actually carries
- mixed-responsibility files are architectural debt
- legacy placement does not automatically define correct ownership
- future refactors should move code toward clearer ownership, not away from it
- code ownership must preserve SG entity integrity
- controller/gate code must protect actions, not replace reasoning model intelligence

Important rule:
- this file maps ownership at a practical high level
- it does not mean every listed file is perfectly clean already
- some mappings are transitional and must be read critically

---

## 2) Ownership labels used in this file

### 2.1 `PRIMARY`
Meaning:
- this file/path mainly belongs to the module
- this is the preferred ownership interpretation

### 2.2 `SHARED`
Meaning:
- the file/path touches multiple modules
- ownership is mixed or cross-cutting
- changes here require extra care

### 2.3 `LEGACY`
Meaning:
- file/path exists and is active or partially active
- but placement/responsibility is not ideal
- do not treat its current shape as perfect architecture truth

### 2.4 `FUTURE`
Meaning:
- expected module ownership area
- may exist only as skeleton, partial runtime, or planned structure

---

## 3) High-level ownership rule

When deciding where code belongs, use this priority:

1. real responsibility of the code
2. canonical module boundaries in `MODULE_MAP.md`
3. canonical agent grouping in `AGENT_DIRECTORY_STRUCTURE.md` when agent boundaries are involved
4. `pillars/DECISIONS.md` for SG philosophy and global boundaries
5. verified repository/runtime state
6. actual repository placement
7. historical convenience

If repository placement and responsibility conflict,
responsibility wins conceptually,
and the mismatch should be treated as debt or transition.

Current factual repo state must not be inferred from old/deprecated maps.
It must follow `REPO_MAP_SOURCE_POLICY.md`.

---

## 4) Root-level files vs modularized `src/`

Current repository has two broad structural layers:

- root-level legacy/runtime entry files
- modularized `src/` structure

General rule:

### Root-level files
Treat as:
- legacy runtime entrypoints
- transitional surface
- higher architectural caution area

### `src/` files
Treat as:
- preferred ownership surface
- better place for stable module boundaries
- future-oriented structure

Important rule:
- do not copy root-level mixed-responsibility style into new code by default
- do not treat legacy/root placement as ownership proof
- do not add new controller/router logic into root files unless explicitly justified

---

## 5) Module → code ownership map

## 5.1 Transport

### PRIMARY
- `src/http/*`
- `src/bootstrap/*`
- `src/bot/*adapter*` if adapter-specific and transport-only
- transport bridge / unified-context transformation areas where they exist

### SHARED
- `index.js` — root runtime entry, may touch startup/wiring concerns
- any router/controller file that still mixes transport and bot concerns

### LEGACY
- root webhook/runtime glue that still carries transport behavior outside preferred module boundaries

### FUTURE
- `src/transport/*` if a dedicated transport folder is introduced later
- channel-specific adapters:
  - Discord adapter
  - Web/API adapter
  - Email adapter

Ownership rule:
- Transport owns input normalization and handoff
- if a file contains transport + business logic, it is mixed debt, not a valid target pattern
- transport code must not become SG identity or governance authority

---

## 5.2 Bot

### PRIMARY
- `src/bot/commandDispatcher.js`
- `src/bot/cmdActionMap.js`
- `src/bot/commands.js`
- `src/bot/handlers/*`

### SHARED
- `src/core/handleMessage.js` if it currently mixes entry, dispatch, and cross-module orchestration
- response-formatting helpers that may sit near chat logic

### LEGACY
- root chat/command logic if still outside `src/bot/*`
- any oversized handler acting like a mini-core

### FUTURE
- `src/bot/handlers/chat/*`
- `src/bot/handlers/admin/*`
- `src/bot/formatting/*`
- callback/reply routing areas if introduced later

Ownership rule:
- Bot owns user-facing routing and thin handlers
- if a handler owns deep feature logic, the file is mixed and should be treated critically
- Bot is an interface/dispatch/access component of SG, not SG itself
- Bot must not become the default SG identity or hidden business core

---

## 5.3 Users / Access

### PRIMARY
- `src/users/userAccess.js`
- `src/users/accessRequests.js`
- `src/users/userProfile.js`

### SHARED
- identity-linking code if split across core/users/runtime layers
- admin surfaces that both check and expose access behavior
- controller/gate code that delegates permission checks to Users / Access

### LEGACY
- scattered role checks inside handlers or runtime files
- command-specific privilege checks outside centralized access boundary

### FUTURE
- `src/users/permissions/*`
- grants/revoke helpers
- role/plan feature maps
- audit-linked access change surfaces

Ownership rule:
- Users / Access owns who may do or access what
- local ad hoc role checks elsewhere are not true ownership, only debt
- access code must not grant component users authority to redefine SG itself
- permissions protect actions/data/scopes, not SG thinking, analysis, explanation, or non-applied planning

---

## 5.4 Memory

### PRIMARY
- `src/memory/*`
- `src/core/MemoryService.js` if this is the active memory boundary
- `src/core/MemoryPolicy.js` or equivalent policy files if present
- `chat_memory` access layer where centralized

### SHARED
- `src/core/handleMessage.js` if it still orchestrates memory usage directly
- recall/history-adjacent files that interact with memory boundaries

### LEGACY
- direct SQL memory writes from handlers or unrelated modules
- memory behavior embedded into chat flow without clear boundary

### FUTURE
- archive/digest/confirmed-memory subareas
- cleanup/compaction helpers
- memory diagnostics helpers

Ownership rule:
- Memory owns long-term reusable context boundaries
- if memory semantics appear in handlers or random services, that is ownership drift
- memory supports SG continuity, but does not replace SG pillars/decisions
- memory writes are protected/state-changing behavior unless explicitly classified otherwise

---

## 5.5 Tasks

### PRIMARY
- `src/tasks/*`
- task runner / scheduler / task lifecycle files where they exist
- task state helpers and run-tracking helpers

### SHARED
- task-related command files in Bot
- logs/telemetry files that record task runs
- source/AI-consuming task executors

### LEGACY
- hidden task-like execution embedded into handlers
- cron/runtime logic outside a clear task boundary

### FUTURE
- queue/worker surfaces
- retry policy helpers
- DLQ surfaces
- task templates / plans

Ownership rule:
- Tasks owns explicit units of work and their lifecycle
- repeated work without task identity is not a valid target pattern
- task automation must not become autonomous SG governance
- task state-changing/external actions must respect permissions/confirmations where configured

---

## 5.6 Sources

### PRIMARY
- `src/sources/*`
- provider-specific source files
- normalization helpers for source payloads
- source diagnostics/check helpers

### SHARED
- feature modules that consume normalized source data
- task executors that orchestrate source use
- diagnostics surfaces exposing source state

### LEGACY
- direct provider calls scattered in handlers or random files
- raw source parsing mixed into business logic files

### FUTURE
- cache-first source helpers
- richer provider registries
- file/document/group-history source adapters

Ownership rule:
- Sources owns data acquisition and normalization
- if provider-specific logic appears outside Sources, that is architectural leakage
- source code provides facts/data to SG, not SG identity

---

## 5.7 Repo

### PRIMARY
- `src/repo/RepoSource.js`
- `src/repo/githubApi.js`
- `src/repo/textFilters.js`
- `src/repo/RepoIndexSnapshot.js`
- `src/repo/RepoIndexService.js`
- `src/simpleAgents/repoStateAgent/*` for RepoStateAgent factual observation pipeline, where present

### SHARED
- repo-review or code-output surfaces that consume repo results
- admin commands exposing repo inspection
- logging/diagnostics for repo indexing/fetching
- Human Mode repo/project facts surfaces that consume RepoStateAgent facts

### LEGACY
- any repo access outside guarded repo boundary
- any direct connector usage bypassing repo abstraction
- old RepoIndex / old map surfaces when used as current factual truth

### FUTURE
- `src/agents/repo-intelligence/repo-state-agent/*` for the future canonical RepoStateAgent location
- richer repo diagnostics
- path classification helpers
- bounded diff prep helpers if explicitly approved later

Ownership rule:
- Repo owns guarded repository understanding
- RepoStateAgent is the factual repository observation subsystem of SG
- repo review/output features consume Repo/RepoStateAgent, but do not own repo access itself
- repo tooling must not become SG itself or autonomous architecture owner
- repo mutation must remain separate from repo inspection and requires explicit permission/approval

---

## 5.7.1 Repo Maintenance Agents

### FUTURE
- `src/agents/repo-maintenance/repo-maintenance-agent/*`

Ownership rule:
- RepoMaintenanceAgent owns post-change repository consistency auditing and planning
- it checks what docs, tests, snapshots, imports, module boundaries, or architecture maps may be affected after repository changes
- it starts as read-only auditor/planner
- it must not replace RepoStateAgent
- it must not own runtime diagnostics
- it must not auto-edit code or pillars by default

Read together with:
- `pillars/architecture/AGENT_DIRECTORY_STRUCTURE.md`
- `pillars/architecture/REPO_MAINTENANCE_AGENT_SKELETON.md`

---

## 5.7.2 Runtime / Diagnostics Agents

### LEGACY
- `src/agentWorkspace/*`
- `agent_workspace/*`

### FUTURE
- `src/agents/runtime-diagnostics/diagnostics-render-agent/*`

Ownership rule:
- DiagnosticsRenderAgent owns runtime/test/Render/log visibility
- it must not directly contain RepoStateAgent logic
- it must not become RepoMaintenanceAgent
- it must not own SG architecture decisions

Read together with:
- `pillars/architecture/AGENT_DIRECTORY_STRUCTURE.md`

---

## 5.7.3 Shared Agent Bridges

### FUTURE
- `src/agents/shared/bridges/*`

Ownership rule:
- shared bridges are explicit adapters between agents
- bridges must not become hidden agents
- bridges must not own SG decisions or identity
- agent-to-agent calls must go through bridges/adapters when boundaries matter

Read together with:
- `pillars/architecture/AGENT_DIRECTORY_STRUCTURE.md`

---

## 5.8 Logging / Diagnostics

### PRIMARY
- `src/logging/*`
- diagnostics-related folders/files
- event log helpers
- health/status surfaces where observability is the main concern

### SHARED
- module-local logging hooks
- admin/operator commands that expose diagnostics
- task/source/repo/runtime status views

### LEGACY
- business behavior hidden in logging side effects
- large diagnostic behavior embedded directly into unrelated feature files

### FUTURE
- alerts
- richer health surfaces
- module-specific diagnostic bundles

Ownership rule:
- Logging / Diagnostics owns visibility, not business decisions
- if a file changes behavior because of logging internals, ownership is already wrong
- diagnostics must not become autonomous SG decision authority

---

## 5.9 Project Memory

### PRIMARY
- project-memory storage helpers
- project section get/upsert helpers
- project restoration/loading helpers

### SHARED
- Bot flows that trigger project restore
- repo-aware project continuity helpers
- logging around project state restoration

### LEGACY
- project rules stored only outside pillars but treated as canonical
- project continuity scattered across chat handlers and notes

### FUTURE
- structured project-state loaders
- project section versioning
- project continuity diagnostics

Ownership rule:
- Project Memory owns persistent project working context
- canonical governance still belongs to pillars, not to code-side project memory
- SG project experience belongs to SG as global entity, not to external AI/helper tools
- Gary's project context must not become default for ordinary users

---

## 5.10 File-Intake

### PRIMARY
- file/media intake handlers
- file-type detection helpers
- OCR/STT/PDF/DOCX parsing entry files
- extracted payload shaping helpers

### SHARED
- Bot handlers that receive file/media input
- AI Routing if extraction result becomes AI input
- logging/diagnostics for extraction quality/failures

### LEGACY
- OCR/STT/document parsing scattered across random handlers
- raw file/media interpretation without a clear intake boundary

### FUTURE
- `src/media/*`
- richer modality classifiers
- structured extraction bundles
- retention/lifecycle helpers

Ownership rule:
- File-Intake owns modality-aware extraction routing
- downstream feature reasoning over extracted content does not change that ownership
- private/sensitive file handling must not bypass permission/scope boundaries

---

## 5.11 AI Routing / Model Control

### PRIMARY
- `modelConfig.js`
- centralized AI call wrappers
- routing helpers deciding model/provider path
- provider abstraction surfaces where they exist

### SHARED
- `ai.js` if still root-level and active as common AI entry
- `src/core/handleMessage.js` if it still participates in AI-call orchestration
- logging/cost/telemetry surfaces tied to AI usage

### LEGACY
- hardcoded model calls in handlers or services
- direct provider usage outside routing boundary

### FUTURE
- `src/ai/*`
- multi-model routing helpers
- modality-aware routing
- AI budget/cost governance helpers

Ownership rule:
- AI Routing owns centralized AI invocation discipline
- if model choice is made ad hoc elsewhere, that is not true ownership, only drift
- external AI/model/provider is an instrument of SG, not SG itself
- AI Routing is model/cost/control wrapper, not SemanticRouter and not SG brain
- AI Routing must not replace reasoning model intelligence with hardcoded routing logic

---

## 5.12 Minimal Controller / Gate

### PRIMARY
- no mandatory standalone heavy module by default
- ownership may live near the specific Human Mode / Technical Mode / capability surface that needs protection
- central reusable helpers may appear later only if repetition proves real need

### SHARED
- Human Mode entry/controller files
- Users / Access permission checks
- capability selector files
- action-type guards
- risk/cost/confirmation helpers
- source/tool requirement checks

### LEGACY
- handler-local gate logic hidden inside large handlers
- command-local permission shortcuts copied many times
- phrase/regex route acting as controller

### FUTURE
- `src/core/capabilities/*`
- `src/core/controller/*`
- `src/core/gates/*`
- `src/core/actionTypes/*`

Ownership rule:
- Minimal Controller / Gate owns action protection flow, not SG thinking
- it checks capability, permission, source/tool need, action type, risk, cost, and confirmation
- it must stay minimal until a real architectural need requires shared extraction
- it must not become a heavy SemanticRouter or hidden god-core
- it must not bypass Users / Access for protected actions

---

## 6) Known mixed-ownership danger zones

The following areas should be treated carefully because they are likely to mix responsibilities:

### 6.1 `index.js`
Risk:
- startup
- runtime glue
- legacy orchestration
- possible transport/core/AI/logging overlap

Interpretation:
- treat as `LEGACY + SHARED`
- avoid expanding it casually

---

### 6.2 `src/core/handleMessage.js`
Risk:
- often becomes a magnet for orchestration, memory access, AI calls, and handler logic
- may become a hidden god-core if controller/routing logic is added carelessly

Interpretation:
- treat as `SHARED`
- useful as a coordination point
- dangerous if it grows into a hidden god-core
- should not become SG brain

---

### 6.3 root-level helper files
Examples:
- `ai.js`
- `classifier.js`
- `sources.js`
- `projectMemory.js`
- `systemPrompt.js`

Interpretation:
- may be active
- may be legacy
- may be transitional wrappers

Rule:
- do not assume current root placement is the ideal ownership model
- check actual responsibility before editing

---

### 6.4 controller/router/helper files
Risk:
- can become hidden routing brains
- can bypass Users / Access
- can accumulate feature logic from many modules
- can turn phrase matching into fake Human Mode intelligence

Interpretation:
- treat as `SHARED + HIGH-RISK`
- keep controller/gate logic minimal
- extract only when repeated responsibility is clear
- never let controller/router code redefine SG identity or governance

---

## 7) What to do when ownership is unclear

When a file seems to belong to multiple modules:

1. ask what responsibility dominates
2. check `DECISIONS.md`
3. check `MODULE_MAP.md`
4. check `AGENT_DIRECTORY_STRUCTURE.md` if agent boundaries are involved
5. check `DATA_FLOW.md`
6. check `PERMISSIONS_MAP.md` if access/action control is involved
7. check `REPO_MAP_SOURCE_POLICY.md` if repo truth/current state is involved
8. treat mixed ownership as architectural risk, not as proof that “everything is flexible”

If still ambiguous:
- document the ambiguity
- do not silently normalize it as correct architecture

---

## 8) When this file must be updated

Update this file when:

- a major file/path clearly changes module ownership
- a legacy area is replaced by a cleaner modular location
- a new major module gets real code presence
- a new agent group or agent code area gets real code presence
- an important mixed-responsibility file is split
- a previously assumed ownership mapping is proven wrong
- RepoStateAgent / factual repo ownership changes
- RepoMaintenanceAgent / repo maintenance ownership changes
- DiagnosticsRenderAgent / runtime diagnostics ownership changes
- controller/gate ownership changes
- code ownership affects SG entity/governance boundaries

Do not update this file for every tiny refactor.

This is a high-level code ownership map, not a full file manifest.

---

## 9) How to use this file during real work

### If changing one module
Read:
- this file
- that module’s `README.md`
- that module’s `CONTRACTS.md`
- `REPO_MAP_SOURCE_POLICY.md` if file placement/current repo truth matters

### If changing or creating an agent
Read:
- this file
- `pillars/architecture/AGENT_DIRECTORY_STRUCTURE.md`
- the relevant agent skeleton file if one exists
- `REPO_MAP_SOURCE_POLICY.md` if repo truth/current state is involved

### If reviewing a large file
Ask:
- which module should own most of this file?
- is the current file mixed?
- is this file legacy/transitional?
- should new logic be added here at all?
- does the file preserve SG entity/component boundaries?
- is controller/router logic becoming hidden god-core?

### If planning refactor
Use this file to decide:
- what should move
- what should stay
- what is real ownership vs historical placement
- how to avoid turning a component into a second SG identity
- how to avoid turning a controller/router/AI wrapper into SG brain

---

## 10) Final rule

A project is not truly modular just because it has module docs.

It becomes modular when:
- module boundaries map to real code ownership
- agent boundaries map to clear responsibility groups
- mixed files are treated critically
- legacy placement is not mistaken for correct architecture
- new code follows responsibility, not convenience
- code ownership remains component ownership inside SG, not ownership over SG itself
- code ownership does not grant authority over SG philosophy, governance, or identity
- controller/gate code protects actions without becoming SG brain
