# project_memory DEVELOPMENT_PLAN

> AGENT NOTE:
> This file defines the planned development path for SG 2.0 Project Memory.
> It is a plan, not a progress tracker.
> Do not add completion labels, mutable status markers, deployment claims, or live runtime proof here.
> Current implementation state must always be verified from the active branch, runtime diagnostics, DB diagnostics, PRs, and deploy evidence.

---

## 0. Core principle

Project Memory is SG 2.0's controlled project-continuity layer.

Target flow:

```text
confirmed project fact
-> controlled memory entry
-> bounded project context
-> safer next action
```

Project Memory must not replace pillars, repository facts, runtime facts, DB diagnostics, or current Monarch instructions.

---

## 1. Module skeleton

Create and maintain the Project Memory module boundary.

Primary areas:

```text
pillars/modules/project_memory/
src/memory/project/
src/memory/index.js
```

Required module documents:

```text
README.md
AGENT_GUIDE.md
CONTRACTS.md
DATA_MODEL.md
RISKS.md
STORAGE_STRATEGY.md
DEVELOPMENT_PLAN.md
```

Purpose:

```text
define what Project Memory does
define what Project Memory must not do
define authority hierarchy
define safe read/write/confirmation/sync boundaries
define implementation verification rules
```

---

## 2. Data model and ownership

Define the Project Memory V1 data model and ownership boundaries.

Required concepts:

```text
project_key
owner_type
visibility
scope
trust
type
source_type
source_ref
metadata
```

Required ownership separation:

```text
SG project memory != user project memory
one user may own many separate projects
different users' projects must never be mixed
ownership must not be inferred from natural-language chat text
```

Expected implementation areas:

```text
src/memory/project/projectMemoryTypes.js
src/memory/project/projectMemoryOwnership.js
```

---

## 3. Prepare-only ProjectMemoryService

Create a service boundary for preparing and validating candidates without confirming or writing final memory.

Expected capabilities:

```text
buildCandidate()
validateCandidate()
normalizeCandidate()
secret guard
raw-log guard
scope guard
metadata guard
```

Forbidden in this layer:

```text
confirmed memory write
AI write
Telegram write
raw chat automatic write
source sync
runtime file mutation
repository mutation
```

Expected implementation area:

```text
src/memory/project/projectMemoryService.js
```

---

## 4. Storage schema

Define Project Memory storage schema separately from runtime proof.

Expected storage boundary:

```text
src/memory/project/projectMemorySchema.js
src/memory/project/projectMemoryStore.js
```

Expected tables:

```text
sg_project_memory_entries
sg_project_memory_write_audit
```

Storage concerns must remain separated:

```text
schema definition
schema bootstrap
formal migration workflow
live DB verification
```

Forbidden shortcuts:

```text
claim live DB readiness from docs only
claim tables exist because schema code exists
hide migrations inside generic PostgreSQL client
secretly auto-migrate during normal message handling
```

---

## 5. Runtime bootstrap and migration governance

Create a safe path for schema setup and future production migrations.

Runtime bootstrap rules:

```text
disabled by default
requires explicit env flag
safe to skip when DB is not configured
must not write memory entries
must not enable prompt injection
must not claim production readiness
```

Expected bootstrap boundary:

```text
src/app/projectMemoryBootstrap.js
```

Formal migration rules:

```text
migrations are explicit
migrations are reviewable in PRs
migrations are ordered
migrations are idempotent or safely tracked
migrations are not hidden inside memory modules
migrations are not hidden inside postgresClient.js
```

Production readiness must be proven with runtime / DB diagnostics.

---

## 6. Durable pending candidate flow

Create a controlled flow for durable pending memory candidates.

Target state for prepared candidates:

```text
trust = candidate
status = pending_confirmation
```

Expected flow areas:

```text
projectMemoryAutomaticCandidatePipeline.js
projectMemoryAutomaticDurableCandidateFlow.js
projectMemoryAutomaticOrchestrator.js
```

Rules:

```text
candidate creation is not confirmation
candidate storage is not confirmed memory
candidate flow must preserve source metadata
candidate flow must fail closed on unsafe input
```

---

## 7. Explicit confirmation flow

Create the boundary that turns pending candidates into confirmed Project Memory only after explicit approval or an approved trusted path.

Expected implementation areas:

```text
projectMemoryConfirmation.js
projectMemoryExplicitConfirmationFlow.js
projectMemoryTrustedConfirmationFlow.js
```

Required checks before confirmation:

```text
permission_check
source_check
confirmation_check
conflict_check
duplicate_check
secret_scan
scope_check
```

Rules:

```text
raw chat does not equal confirmation
AI-generated candidates require explicit confirmation unless a trusted path is explicitly approved
confirmation must preserve source metadata
confirmation must not bypass permissions
confirmation must not blindly overwrite active entries
```

---

## 8. Confirmed read flow

Create bounded read access to confirmed Project Memory.

Read condition:

```text
trust = confirmed
status = active
```

Expected implementation areas:

```text
projectMemoryConfirmedReadFlow.js
projectMemoryRuntimeContext.js
```

Read rules:

```text
bounded result count
bounded character budget
stale/conflicted entries must be labelled
no secrets
no raw logs
no raw provider IDs
no private transport identifiers
```

---

## 9. Context builder

Create a bounded context builder for project work.

Allowed context families:

```text
confirmed decisions
active constraints
module boundaries
workflow rules
known risks
next steps
rollback points
project terminology
implementation status snapshots
```

Forbidden context material:

```text
raw chat dumps
secrets
raw logs
raw provider IDs
AI guesses
unverified claims
stale/conflicted entries without labels
```

Context builder output must be support context only and must not outrank pillars, verified repository facts, runtime facts, DB diagnostics, or Monarch instruction.

---

## 10. Message context gate

Create a feature-gated bridge that can optionally include confirmed Project Memory in message context.

Rules:

```text
read disabled by default
prompt injection disabled by default
confirmed-only
bounded entries
bounded characters
no raw chat auto-write
no automatic confirmed writes
```

Expected concept:

```text
MessageProjectMemoryContextGate
```

This layer must not be Telegram-coupled.

---

## 11. Project restore interface

Create an interface for restoring project continuity at the beginning of work sessions.

Restore context should include:

```text
active rules
active constraints
important decisions
module boundaries
current risks
safe next steps
latest rollback point when verified
```

Rules:

```text
restore uses confirmed/bounded context only
restore must mark stale/conflicted entries
restore must prefer pillars/repo/runtime facts over memory
restore must not invent missing facts
```

---

## 12. Trusted event source

Create a source boundary for trusted project events.

Future trusted source families:

```text
PR merged
runtime observation
repo evidence
approved session summary
manual Monarch command
```

Rules:

```text
trusted source normalizes event data
trusted source does not write confirmed memory by itself
observation is telemetry and must not directly write Project Memory
source metadata must be preserved
unsafe or ambiguous source data must fail closed
```

---

## 13. Runtime trusted event tool

Create an internal tool/handler for trusted project events.

Target flow:

```text
trusted project event
-> trusted event source
-> orchestrator bridge
-> durable pending candidate
```

Rules:

```text
no auto-confirm by default
no confirmed memory writes by default
no AI calls
no Telegram direct touch
no raw chat usage
no source sync
no GitHub/Render fetching inside the tool
no runtime/repo writes from the tool
```

---

## 14. AI tool registry boundary

Create a safe allowlisted registry for internal tools that future AI/runtime orchestration may call.

Target flow:

```text
AI Tool Registry
-> allowlisted internal tool
-> safe deterministic result
```

Rules:

```text
registry does not call AI providers
registry does not perform provider function-calling
registry does not fetch GitHub/Render/sources
registry does not write runtime files
registry does not mutate repository state
registry does not change env
registry does not confirm memory by itself
```

---

## 15. Runtime invocation bridge

Create a runtime-facing bridge for invoking allowlisted tools through one controlled entrypoint.

Target flow:

```text
Runtime Invocation Bridge
-> AI Tool Registry
-> allowlisted tool
-> safe output
```

Rules:

```text
explicit runtime invocation request required
allowlisted tools only
no AI provider calls
no provider function-calling
no prompt mutation
no raw chat reads
no Telegram coupling
no source fetching
no runtime writes
no repo mutation
no confirmed memory writes
```

---

## 16. Controlled runtime command adapter

Create a controlled adapter that can later accept an internal command-like request and route it into the runtime invocation bridge.

Rules:

```text
internal command adapter only
no direct Telegram write command
no raw user chat -> Project Memory write
no AI function-calling -> Project Memory confirmed write
no auto-confirm
no confirmed memory writes unless explicit confirmation path is used
```

This adapter must remain separate from transport modules.

---

## 17. Conflict and stale detection

Create detection for memory entries that should not be trusted blindly.

Detection families:

```text
stale entries
conflicting entries
duplicates
superseded entries
archived entries
entries contradicted by pillars
entries contradicted by verified repo/runtime evidence
```

Expected behavior:

```text
warn before using conflicted memory
prefer higher authority source
mark stale/conflicted entries in context output
require Monarch decision when conflict cannot be resolved safely
```

---

## 18. Source sync interface

Create a controlled sync interface from approved sources.

Allowed future source families:

```text
pillars
repo_evidence
runtime_observation
approved_session_summary
manual_monarch_command
```

Rules:

```text
sync sources must be allowlisted
sync must prefer source references over copied raw content
sync must not import secrets
sync must not import raw logs
sync must not run as autonomous cron/timer without approval
sync creates candidates first unless a trusted path is explicitly approved
```

---

## 19. Memory diagnostics

Create diagnostics for Project Memory health and boundaries.

Diagnostic families:

```text
storage status
schema status
candidate count
confirmed count
stale/conflict count
feature flags
read gate status
write gate status
last restore context summary
```

Forbidden diagnostic output:

```text
secrets
raw DATABASE_URL
raw logs
raw provider IDs
private transport IDs
unredacted user identifiers
```

Diagnostics must distinguish:

```text
available code
configured runtime
verified DB state
production readiness
```

---

## 20. Project experience lessons

Create a reviewed memory path for project experience and lessons learned.

Allowed lesson families:

```text
successful architecture patterns
failed approaches
recurring errors
safe rollback lessons
workflow improvements
module boundary lessons
```

Rules:

```text
lessons require review or confirmation
lessons must preserve source references
lessons must not become raw chat summaries
lessons must not override pillars or Monarch decisions
```

---

## 21. Production readiness verification

Verify Project Memory as production-ready only after runtime and DB evidence exists.

Minimum checks:

```text
DATABASE_URL configured without exposing secrets
DB connection works
sg_project_memory_entries exists
sg_project_memory_write_audit exists
expected indexes exist
expected constraints exist
candidate creation tested safely
confirmation tested safely
confirmed read tested safely
restore context tested safely
feature flags verified safe
diagnostics verified safe
rollback path exists
```

Production readiness must not be claimed from docs or schema code alone.

---

## 22. Final Project Memory system

Final Project Memory must include:

```text
controlled storage model
confirmed write pipeline
pending memory candidate pipeline
context builder
project restore interface
source sync interface
conflict/stale detection
memory diagnostics
project experience lessons
production readiness verification
```

Final behavior:

```text
SG restores the right project context before project work,
uses confirmed memory only as bounded support context,
detects conflicts and stale facts,
keeps Project Memory below pillars/repo/runtime/DB evidence/Monarch decisions,
and never turns Project Memory into uncontrolled AI self-writing memory.
```
