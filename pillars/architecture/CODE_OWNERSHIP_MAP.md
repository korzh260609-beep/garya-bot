# CODE_OWNERSHIP_MAP.md — SG Code Ownership Map

Purpose:
- Define the canonical mapping between logical modules and real repository code areas.
- Reduce ambiguity about which files belong to which responsibility domain.
- Help humans and AI tools understand where to work and where NOT to work.

Status: CANONICAL
Scope: repository code ownership at a high level

---

## 0) Why this file exists

`MODULE_MAP.md` defines logical modules.

`REPOINDEX.md` defines repository structure and responsibility zones.

This file exists to connect those two:

- module meaning
- real code locations
- likely ownership boundaries
- legacy vs preferred placement

Without this map, one common problem appears:

- docs describe modules clearly
- but nobody knows which real files are inside those modules
- or which files are legacy, mixed, or transitional

This file reduces that ambiguity.

---

## 1) Core principle

Code ownership must follow responsibility,
not convenience.

That means:

- a file belongs to the module whose responsibility it actually carries
- mixed-responsibility files are architectural debt
- legacy placement does not automatically define correct ownership
- future refactors should move code toward clearer ownership, not away from it

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
3. actual repository placement
4. historical convenience

If repository placement and responsibility conflict,
responsibility wins conceptually,
and the mismatch should be treated as debt or transition.

---

## 4) Root-level files vs modularized `src/`

Current repository has two broad structural layers already described in `REPOINDEX.md`:

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

---

## 5.3 Users / Access

### PRIMARY
- `src/users/userAccess.js`
- `src/users/accessRequests.js`
- `src/users/userProfile.js`

### SHARED
- identity-linking code if split across core/users/runtime layers
- admin surfaces that both check and expose access behavior

### LEGACY
- scattered role checks inside handlers or runtime files
- command-specific privilege checks outside centralized access boundary

### FUTURE
- `src/users/permissions/*`
- grants/revoke helpers
- role/plan feature maps
- audit-linked access change surfaces

Ownership rule:
- Users / Access owns who may do what
- local ad hoc role checks elsewhere are not true ownership, only debt

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

---

## 5.7 Repo

### PRIMARY
- `src/repo/RepoSource.js`
- `src/repo/githubApi.js`
- `src/repo/textFilters.js`
- `src/repo/RepoIndexSnapshot.js`
- `src/repo/RepoIndexService.js`

### SHARED
- repo-review or code-output surfaces that consume repo results
- admin commands exposing repo inspection
- logging/diagnostics for repo indexing/fetching

### LEGACY
- any repo access outside guarded repo boundary
- any direct connector usage bypassing repo abstraction

### FUTURE
- richer repo diagnostics
- path classification helpers
- bounded diff prep helpers if explicitly approved later

Ownership rule:
- Repo owns guarded repository understanding
- repo review/output features consume Repo, but do not own repo access itself

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

Interpretation:
- treat as `SHARED`
- useful as a coordination point
- dangerous if it grows into a hidden god-core

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

## 7) What to do when ownership is unclear

When a file seems to belong to multiple modules:

1. ask what responsibility dominates
2. check `MODULE_MAP.md`
3. check `DATA_FLOW.md`
4. check `PERMISSIONS_MAP.md` if access is involved
5. treat mixed ownership as architectural risk, not as proof that “everything is flexible”

If still ambiguous:
- document the ambiguity
- do not silently normalize it as correct architecture

---

## 8) When this file must be updated

Update this file when:

- a major file/path clearly changes module ownership
- a legacy area is replaced by a cleaner modular location
- a new major module gets real code presence
- an important mixed-responsibility file is split
- a previously assumed ownership mapping is proven wrong

Do not update this file for every tiny refactor.

This is a high-level code ownership map, not a full file manifest.

---

## 9) How to use this file during real work

### If changing one module
Read:
- this file
- that module’s `README.md`
- that module’s `CONTRACTS.md`
- `REPOINDEX.md` if file placement matters

### If reviewing a large file
Ask:
- which module should own most of this file?
- is the current file mixed?
- is this file legacy/transitional?
- should new logic be added here at all?

### If planning refactor
Use this file to decide:
- what should move
- what should stay
- what is real ownership vs historical placement

---

## 10) Final rule

A project is not truly modular just because it has module docs.

It becomes modular when:
- module boundaries map to real code ownership
- mixed files are treated critically
- legacy placement is not mistaken for correct architecture
- new code follows responsibility, not convenience