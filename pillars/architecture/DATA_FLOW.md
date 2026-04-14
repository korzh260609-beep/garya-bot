# DATA_FLOW.md — SG Data Flow Map

Purpose:
- Define the canonical high-level data flows of SG.
- Show how information should move between modules.
- Reduce architectural drift caused by ad hoc shortcuts.

Status: CANONICAL
Scope: high-level logical data flows across SG modules

---

## 0) Why this file exists

`MODULE_MAP.md` defines what each module owns.

This file defines how data should move between those modules.

These are different questions:

- Module map = who owns responsibility
- Data flow map = how information moves safely

Without an explicit flow map, modules may still exist,
but real runtime behavior can drift into shortcut-based architecture.

---

## 1) Core principle

SG must prefer explicit bounded flows.

This means:

- input enters through clear boundaries
- modules exchange only what they should exchange
- ownership is preserved during handoff
- shortcuts are treated as risk, not convenience

A working shortcut is not automatically an acceptable architecture path.

---

## 2) Canonical top-level flow

Preferred top-level flow:

Transport
→ Bot
→ Users / Access
→ relevant module(s)
→ Logging / Diagnostics
→ user-facing output

Important note:
- this is a canonical control/data flow shape
- not every module appears in every request
- but random bypass paths are not acceptable by default

---

## 3) Main flow types

### 3.1 Text/chat interaction flow

Canonical flow:

Transport
→ normalized context
→ Bot dispatch
→ Users / Access check as needed
→ relevant feature/module
→ Logging / Diagnostics
→ Bot response formatting
→ user-facing output

Purpose:
- standard conversational/command flow

Hard rule:
- Transport does not own business meaning
- Bot does not own deep module logic
- output remains bounded and reviewable

---

### 3.2 Memory-aware flow

Canonical flow:

Transport/Bot input
→ access/feature context
→ Memory read/context selection if needed
→ feature/module logic
→ Memory write if explicitly appropriate
→ Logging / Diagnostics
→ output

Important distinction:
- Memory read/write is not automatic for everything
- Chat history is not equal to memory
- Memory usage must stay policy-bound

Hard rule:
- memory must not be bypassed by ad hoc direct handler logic
- memory context must be selected, not dumped

---

### 3.3 Source-first flow

Canonical flow:

Bot/Task/feature request
→ Users / Access if needed
→ Sources fetch
→ source normalization
→ feature logic / robot layer / analysis layer
→ Logging / Diagnostics
→ output

Purpose:
- preserve source-first discipline

Hard rule:
- unavailable source data must not be silently invented
- raw source payload must not bypass normalization where normalized shape is required

---

### 3.4 File/media intake flow

Canonical flow:

Transport/Bot receives file/media
→ File-Intake detect type
→ File-Intake route by modality
→ specialized extraction/parsing
→ bounded extracted payload
→ downstream feature logic / AI routing if needed
→ Logging / Diagnostics
→ output

Purpose:
- preserve modality-aware processing

Hard rule:
- extraction comes before interpretation where modality requires it
- raw media must not be treated as already-usable semantic text

---

### 3.5 AI-assisted flow

Canonical flow:

feature/module decides AI may be needed
→ AI Routing decides whether AI should be called
→ model/provider route selected
→ centralized AI call
→ result returned to owning module
→ Logging / Diagnostics
→ output

Purpose:
- preserve centralized AI-call discipline

Hard rule:
- direct scattered model calls are forbidden
- AI routing must not steal feature ownership

---

### 3.6 Task execution flow

Canonical flow:

Bot/manual trigger or scheduler trigger
→ Users / Access if needed
→ Tasks module resolves task identity/state
→ task run starts
→ task consumes required modules (Sources / Memory / AI Routing / others)
→ run result/failure recorded
→ Logging / Diagnostics
→ optional user-facing output

Purpose:
- preserve explicit execution boundaries

Hard rule:
- task-like work must not become invisible ad hoc execution
- duplicate-run/idempotency concerns must stay visible where relevant

---

### 3.7 Repo inspection flow

Canonical flow:

authorized request
→ Users / Access
→ Repo guarded fetch/list/index path
→ bounded repo review/inspection
→ Logging / Diagnostics
→ output

Purpose:
- preserve read-oriented repository understanding

Hard rule:
- repo inspection does not imply repo mutation
- guarded path rules remain explicit

---

### 3.8 Project continuity flow

Canonical flow:

project-aware request/session
→ Project Memory load/restore
→ relevant project-aware module work
→ optional Project Memory update
→ Logging / Diagnostics
→ output

Purpose:
- preserve project continuity without replacing canonical pillars

Hard rule:
- project memory does not override pillars
- restored project context must remain bounded

---

## 4) Cross-module flow rules

### 4.1 Transport → Bot
Allowed:
- normalized context handoff

Forbidden:
- business logic embedded into transport handoff

---

### 4.2 Bot → owning module
Allowed:
- dispatch and lightweight argument shaping

Forbidden:
- deep business logic accumulation in handlers

---

### 4.3 Users / Access → feature/module
Allowed:
- explicit access decision
- explicit deny/allow gating

Forbidden:
- hidden privilege assumptions outside access boundary

---

### 4.4 Sources → downstream modules
Allowed:
- normalized source result
- explicit failure state

Forbidden:
- fabricated data on source failure
- uncontrolled raw provider payload dependence where normalization is required

---

### 4.5 File-Intake → downstream modules
Allowed:
- bounded extracted payload
- explicit extraction limits/failure state

Forbidden:
- pretending extraction certainty where there is none

---

### 4.6 AI Routing → owning module
Allowed:
- centralized AI result
- bounded routing metadata

Forbidden:
- routing layer taking over feature meaning

---

### 4.7 Logging / Diagnostics ↔ all modules
Allowed:
- observability hooks
- review surfaces

Forbidden:
- logging becoming hidden control-plane logic

---

## 5) Bypass patterns to treat as architectural risk

The following flow shortcuts are dangerous by default:

- Transport → business logic directly
- Bot handler → direct provider/model/storage spaghetti
- feature → direct model call bypassing AI Routing
- feature → direct repo access bypassing Repo boundary
- handler → direct memory semantics bypass
- source failure → guessed data without explicit source state
- file/media input → direct reasoning without proper intake/extraction path

These patterns may still produce output,
but they damage architecture.

---

## 6) Boundedness rule

Every flow should stay bounded in at least these dimensions:

- scope
- payload size
- ownership
- reviewability
- failure visibility

If a flow becomes too broad or too implicit,
it stops being safe even if it still functions.

---

## 7) Failure visibility rule

A correct flow is not just one that succeeds.

A correct flow must also make failure visible enough.

Important examples:
- source unavailable
- extraction weak/failed
- access denied
- task duplicated/blocked
- AI route unavailable
- repo path denied

Hiding these failures creates false confidence.

---

## 8) Source hierarchy rule

When flows conflict, source hierarchy remains:

1. verified repository/runtime behavior
2. canonical pillars
3. project memory / bounded working context
4. ordinary memory / chat-derived supporting context

No lower layer may silently override a higher canonical layer.

---

## 9) When this file must be updated

Update this file when:

- a new major module enters the canonical flow
- a major handoff path changes
- a new cross-module dependency becomes canonical
- a dangerous bypass becomes intentionally formalized
- a previously assumed flow is proven wrong

Do not update this file for tiny local refactors.

This file maps canonical flow shape, not every implementation detail.

---

## 10) Final rule

Architecture is not only “what modules exist”.

Architecture is also “how data is allowed to move”.

If the flow map becomes implicit,
the module map alone will not save the system.