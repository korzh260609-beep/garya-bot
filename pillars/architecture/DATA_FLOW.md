# DATA_FLOW.md — SG Data Flow Map

Purpose:
- Define the canonical high-level data flows of SG.
- Show how information should move between modules.
- Reduce architectural drift caused by ad hoc shortcuts.
- Preserve the controlled-action model from `pillars/DECISIONS.md`.

Status: CANONICAL
Scope: high-level logical data flows across SG modules

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/README.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/SEMANTIC_ROUTING.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

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

## 0.1) SG entity rule for data flow

SG is the global project entity and global intellectual system.

Data flows connect SG components.

A data flow must not turn a component, mode, agent, tool, model, transport, controller, or subsystem into a separate independent SG.

Correct model:

```text
SG = global project entity / global intellectual system
flow = bounded movement between SG components
component = instrument/subsystem of SG
minimal controller/gate = action protection boundary, not SG brain
```

Incorrect model:

```text
flow -> isolated component -> separate SG identity
external AI/tool -> owns SG decision/memory/experience
handler/router/controller -> becomes SG brain
```

---

## 1) Core principle

SG must prefer explicit bounded flows.

This means:

- input enters through clear boundaries
- modules exchange only what they should exchange
- ownership is preserved during handoff
- shortcuts are treated as risk, not convenience
- component identity remains subordinate to SG entity integrity
- protected actions pass through permission/source/risk/confirmation checks

A working shortcut is not automatically an acceptable architecture path.

---

## 2) Canonical top-level flows

### 2.1 Current technical/runtime flow

Preferred current technical/runtime flow:

```text
Transport
→ Bot
→ Users / Access
→ relevant module(s)
→ Logging / Diagnostics
→ user-facing output
```

Important note:
- this is a canonical control/data flow shape for the current implementation
- not every module appears in every request
- random bypass paths are not acceptable by default
- current runtime flow does not redefine what SG is meant to become

### 2.2 Human Mode controlled flow

Preferred Human Mode controlled flow:

```text
Transport
→ Bot / HumanModeEntry
→ reasoning model / meaning provider
→ meaning / intent / context
→ Minimal Controller / Gate
   → capability check
   → permission/scope check
   → source/tool check
   → read-only vs state-changing check
   → risk/cost/confirmation check
→ relevant module/source/tool
→ ResponseBuilder / Delivery
```

Purpose:
- keep natural user interaction meaning-first
- keep protected actions controlled
- prevent old command/handler logic from becoming fake intelligence

### 2.3 Project/repository flow

For project/repository work, Human Mode must follow the RepoStateAgent factual-source policy:

```text
Human Mode
→ meaning / intent / context
→ permission / scope / capability boundary
→ RepoStateAgent-backed facts when repo facts are needed
→ risk / confirmation check when action is not read-only
→ SG response/action
```

---

## 3) Main flow types

### 3.1 Text/chat interaction flow

Canonical flow:

```text
Transport
→ normalized context
→ Bot dispatch
→ Users / Access check as needed
→ Human Mode or Technical Mode boundary
→ relevant feature/module
→ Logging / Diagnostics
→ Bot response formatting
→ user-facing output
```

Purpose:
- standard conversational/command flow

Hard rule:
- Transport does not own business meaning
- Bot does not own deep module logic
- output remains bounded and reviewable
- Human Mode and Technical Mode must not be mixed as identities

---

### 3.2 Human Mode project/repo flow

Canonical flow:

```text
User natural request
→ Transport/Bot normalized context
→ HumanModeEntry
→ reasoning model / meaning provider
→ meaning / intent / context
→ Users / Access / permission / scope check
→ capability selection
→ source/tool need check
→ RepoStateAgent-backed factual read when repo facts are needed
→ project/context reasoning
→ risk / cost / confirmation check
→ response builder
→ Logging / Diagnostics
→ user-facing output or permitted action
```

Purpose:
- preserve meaning-first project/repo interaction without legacy phrase routing
- protect repo/project access and actions through controller/gate checks

Hard rule:
- raw text must not be treated as exact command routing
- old RepoIndex / old maps / old snapshots must not be used as current factual truth
- RepoStateAgent is a factual observation subsystem of SG, not a separate SG
- Human Mode runtime must stay gated until explicitly approved
- controller/gate protects actions; it must not become SG brain

---

### 3.3 Technical Mode flow

Canonical flow:

```text
Explicit command/debug/test input
→ Transport/Bot normalized context
→ Technical Mode route
→ minimal controller/gate if protected surface is touched
→ relevant command/diagnostic/legacy surface
→ Logging / Diagnostics
→ explicit technical output
```

Purpose:
- preserve commands, diagnostics, tests, and legacy routes without contaminating Human Mode

Hard rule:
- Technical Mode may require exact syntax
- Technical Mode is not SG’s intelligence layer
- old phrase/keyword/regex logic remains Technical Mode unless replaced by verified Human Mode architecture
- Technical Mode must not bypass permissions, private boundaries, source policy, or confirmations for protected actions

---

### 3.4 Memory-aware flow

Canonical flow:

```text
Transport/Bot input
→ access/feature context
→ Memory read/context selection if needed
→ feature/module logic
→ Memory write if explicitly appropriate
→ Logging / Diagnostics
→ output
```

Important distinction:
- Memory read/write is not automatic for everything
- Chat history is not equal to memory
- Memory usage must stay policy-bound

Hard rule:
- memory must not be bypassed by ad hoc direct handler logic
- memory context must be selected, not dumped
- project memory supports SG continuity, but does not replace pillars or verified repo/runtime facts
- private/user/project memory boundaries must not be bypassed

---

### 3.5 Source-first flow

Canonical flow:

```text
Bot/Task/feature request
→ Users / Access if needed
→ Sources fetch
→ source normalization
→ feature logic / robot layer / analysis layer
→ Logging / Diagnostics
→ output
```

Purpose:
- preserve source-first discipline

Hard rule:
- unavailable source data must not be silently invented
- raw source payload must not bypass normalization where normalized shape is required
- AI/model memory must not replace real source data
- source/tool checks must be explicit when facts matter

---

### 3.6 File/media intake flow

Canonical flow:

```text
Transport/Bot receives file/media
→ File-Intake detect type
→ File-Intake route by modality
→ specialized extraction/parsing
→ bounded extracted payload
→ downstream feature logic / AI routing if needed
→ Logging / Diagnostics
→ output
```

Purpose:
- preserve modality-aware processing

Hard rule:
- extraction comes before interpretation where modality requires it
- raw media must not be treated as already-usable semantic text
- file/media content must not bypass privacy/scope/source rules

---

### 3.7 AI-assisted flow

Canonical flow:

```text
feature/module decides AI may be needed
→ AI Routing / Model Control checks model/cost policy
→ model/provider route selected
→ centralized AI call
→ result returned to owning module
→ Logging / Diagnostics
→ output
```

Purpose:
- preserve centralized AI-call discipline

Hard rule:
- direct scattered model calls are forbidden
- AI Routing must not steal feature ownership
- AI Routing is model/cost/control wrapper, not SG brain
- external AI/model/provider is an instrument, not SG itself
- AI result does not override source-of-truth policy

---

### 3.8 Task execution flow

Canonical flow:

```text
Bot/manual trigger or scheduler trigger
→ Users / Access if needed
→ Tasks module resolves task identity/state
→ task run starts
→ task consumes required modules (Sources / Memory / AI Routing / others)
→ run result/failure recorded
→ Logging / Diagnostics
→ optional user-facing output
```

Purpose:
- preserve explicit execution boundaries

Hard rule:
- task-like work must not become invisible ad hoc execution
- duplicate-run/idempotency concerns must stay visible where relevant
- task engine must not act autonomously outside SG governance
- state-changing/external task actions require permission/confirmation where configured

---

### 3.9 Repo inspection flow

Canonical flow:

```text
authorized request
→ Users / Access
→ Repo guarded fetch/list/index path or RepoStateAgent factual path
→ bounded repo review/inspection
→ Logging / Diagnostics
→ output
```

Purpose:
- preserve read-oriented repository understanding

Hard rule:
- repo inspection does not imply repo mutation
- guarded path rules remain explicit
- current project-map/status/architecture-health claims must follow `REPO_MAP_SOURCE_POLICY.md`
- prepare-only code proposals must not be applied without permission

---

### 3.10 Project continuity flow

Canonical flow:

```text
project-aware request/session
→ Project Memory load/restore
→ relevant project-aware module work
→ optional Project Memory update
→ Logging / Diagnostics
→ output
```

Purpose:
- preserve project continuity without replacing canonical pillars
- preserve SG project experience across sessions and tools

Hard rule:
- project memory does not override pillars
- restored project context must remain bounded
- external AI helpers may read project experience, but do not own it
- Gary's project context must not become default for ordinary users

---

## 4) Cross-module flow rules

### 4.1 Transport → Bot
Allowed:
- normalized context handoff

Forbidden:
- business logic embedded into transport handoff
- transport becoming SG identity

---

### 4.2 Bot → owning module
Allowed:
- dispatch and lightweight argument shaping

Forbidden:
- deep business logic accumulation in handlers
- bot becoming SG identity

---

### 4.3 Users / Access → feature/module
Allowed:
- explicit access decision
- explicit deny/allow gating
- private scope protection

Forbidden:
- hidden privilege assumptions outside access boundary
- treating permissions as limits on SG thinking instead of action/private-data protection

---

### 4.4 Minimal Controller / Gate → feature/module
Allowed:
- capability selection
- permission/scope check
- source/tool requirement check
- action type check
- risk/cost/confirmation check

Forbidden:
- becoming SG brain
- replacing reasoning model intelligence
- bypassing source-first policy
- bypassing confirmation for state-changing/external actions

---

### 4.5 Sources → downstream modules
Allowed:
- normalized source result
- explicit failure state

Forbidden:
- fabricated data on source failure
- uncontrolled raw provider payload dependence where normalization is required

---

### 4.6 File-Intake → downstream modules
Allowed:
- bounded extracted payload
- explicit extraction limits/failure state

Forbidden:
- pretending extraction certainty where there is none

---

### 4.7 AI Routing → owning module
Allowed:
- centralized AI result
- bounded routing metadata
- model/cost control

Forbidden:
- routing layer taking over feature meaning
- AI routing or model provider acting as SG itself
- AI routing becoming a heavy SemanticRouter

---

### 4.8 Logging / Diagnostics ↔ all modules
Allowed:
- observability hooks
- review surfaces

Forbidden:
- logging becoming hidden control-plane logic
- diagnostics becoming autonomous decision authority

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
- Human Mode → old phrase/keyword/regex routing
- Human Mode → old RepoIndex / stale snapshot as current repo truth
- Human Mode / Technical Mode → protected action bypassing minimal controller/gate
- heavy router replacing reasoning model intelligence
- controller/gate becoming separate SG brain
- external AI/tool → owns SG decision/memory/project experience
- component/mode/agent/tool → behaves as separate SG

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
- entity integrity
- permission surface
- action type

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
- RepoStateAgent facts unavailable
- Human Mode runtime gate closed
- permission/scope unclear
- confirmation required but missing
- action blocked because it is state-changing/external/sensitive

Hiding these failures creates false confidence.

---

## 8) Source hierarchy rule

When flows conflict, separate factual implementation state from SG philosophy.

### 8.1 Factual implementation state

For what currently exists in code/runtime:

1. verified repository/runtime behavior
2. RepoStateAgent / verified repo observation where available
3. active architecture/module docs
4. project memory / bounded working context
5. ordinary memory / chat-derived supporting context

### 8.2 SG philosophy and intended direction

For what SG is meant to be and how architecture must evolve:

1. `pillars/DECISIONS.md`
2. `pillars/SG_ENTITY.md`
3. `pillars/PROJECT.md`
4. `pillars/SG_BEHAVIOR.md`
5. aligned architecture/workflow/module docs
6. project memory / bounded working context
7. chat discussion / temporary explanations

No lower layer may silently override a higher canonical layer.

Runtime reality shows what exists now; it does not redefine SG's intended philosophy.

---

## 9) When this file must be updated

Update this file when:

- a new major module enters the canonical flow
- a major handoff path changes
- a new cross-module dependency becomes canonical
- a dangerous bypass becomes intentionally formalized
- a previously assumed flow is proven wrong
- Human Mode / Technical Mode boundaries change
- RepoStateAgent factual source flow changes
- a component identity rule changes
- minimal controller/gate boundaries change
- action type / confirmation flow changes

Do not update this file for tiny local refactors.

This file maps canonical flow shape, not every implementation detail.

---

## 10) Final rule

Architecture is not only “what modules exist”.

Architecture is also “how data is allowed to move”.

Data flows connect SG components.
They must not create separate SG identities.

Protected actions must pass through controlled boundaries.

If the flow map becomes implicit,
the module map alone will not save the system.
