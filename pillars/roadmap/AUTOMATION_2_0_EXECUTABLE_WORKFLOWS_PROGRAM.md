# SG Automation 2.0 — Executable Workflows Program

Status: PLANNED / NOT IMPLEMENTED

## Goal

Upgrade the existing SG durable automation substrate from static self-notifications and schedule-only updates into versioned executable workflows that SG can create, semantically identify, patch, execute, observe and safely deliver.

Automation 2.0 is a cross-cutting program. It reuses Block 9 Automation & Agents, Block 13 Durable Automation & Workers, Temporal Context, Capability System, Identity/Scope, Access Control, Resource Authority, Action Gate, Credential Manager, Delivery Router, PostgreSQL and Observability. It does not create parallel infrastructure.

## Implementation stages

### AW2.1 — Workflow contract
- Define `automationId`, `version`, `trigger`, `steps`, `inputs`, `delivery`, `executionPolicy`, scope and provenance.
- Preserve backward compatibility for existing `self-notification` tasks.
- Add schema/version guards.

### AW2.2 — Canonical step types
- `collect`
- `retrieve`
- `analyze`
- `compose`
- `invoke-capability`
- `deliver`

No phrase/keyword routing is allowed as workflow semantics.

### AW2.3 — Workflow Executor
- Execute ordered steps.
- Pass bounded step outputs to following steps.
- Persist per-step status and outputs/evidence references.
- Support `completed`, `partial`, `failed`, `denied`, `cancelled` outcomes.

### AW2.4 — Execution-time security
For each protected step re-check:
- Identity/Global ID;
- SG access/entitlement;
- Resource Ownership & Authority;
- Action Gate;
- Credential/connection availability;
- capability/resource permission health.

Creation-time authority must never become permanent execution authority.

### AW2.5 — Autonomous read-only work
Allow approved read-only workflows to collect fresh data, retrieve approved sources, analyze and compose reports without requiring per-occurrence manual confirmation when policy allows.

### AW2.6 — State-changing execution envelope
State-changing/external steps require explicit bounded execution policy: capability, resource scope, action class, risk and confirmation/delegation semantics. Scheduled execution cannot broaden authorization.

### AW2.7 — Automation update capability
Introduce a canonical `automation-update` path able to modify workflow content as well as schedule fields.

Supported changes:
- add/remove/replace steps;
- change notification/content;
- change sources/resources;
- change output format;
- change delivery;
- change recurrence/time/timezone;
- change execution policy;
- pause/resume/cancel.

### AW2.8 — Semantic target resolution
Users must not need internal schedule/automation IDs.
- Resolve existing workflow semantically within canonical scope.
- One match → select.
- Zero/multiple matches → fail closed with one clarification.
- Never invent target attributes or IDs.

### AW2.9 — Patch, not duplicate
Updating an existing automation patches the same `automationId` and creates a new version. Do not create a second schedule/task unless the user explicitly requests a new/copy automation.

### AW2.10 — Versioning and history
Persist:
- version;
- parent version;
- actor;
- timestamp;
- patch summary;
- request/trace provenance;
- gate/validation outcome.

Support history inspection and later safe rollback/restore.

### AW2.11 — Runtime fresh-data collection
Execution-time collectors must fetch current authorized evidence, not replay stale prepared text as current data.

### AW2.12 — Workspace Activity Collector
Add a read-only capability for authorized workspace activity that returns deterministic persisted/live evidence such as publications, polls, tests, interactions, activity events and data-window metadata.

### AW2.13 — Multi-workspace aggregation
Aggregate across multiple currently authorized workspaces while checking each resource independently. Lost/unavailable resources must be explicit omissions, not invented zeros unless the metric contract defines zero from authoritative persisted absence.

### AW2.14 — Dynamic composition
Compose the final user-facing result at execution time from fresh step outputs. AI use, where needed, must go through AI Router with logged cost/reason and may not fabricate deterministic metrics.

### AW2.15 — Failure and retry policy
Define deterministic handling for:
- partial source/resource failure;
- lost authority;
- temporary API/provider failure;
- permanent capability failure;
- final delivery failure;
- bounded retry/backoff;
- false-success prevention.

### AW2.16 — Execution history
Persist each run with automation/version/occurrence, step transitions, sources, outputs, errors, gate decisions, AI calls/cost and delivery result.

### AW2.17 — Idempotency and restart continuity
- Stable occurrence identity.
- Retry/restart must not duplicate external delivery.
- Durable workflow/version resolution after worker restart.
- Scheduler materialization remains replay-safe.

### AW2.18 — Natural-language lifecycle
Support semantic instructions equivalent to:
- add/remove a part of an existing task;
- also collect/check something;
- replace what the task does;
- change output style;
- change cadence/time;
- pause/resume/cancel;
- restore a previous version.

No exact phrase list is allowed as the implementation mechanism.

### AW2.19 — Regression and security tests
Minimum coverage:
- patch existing automation;
- no duplicate creation;
- fresh runtime collection;
- lost authority after creation;
- multiple workspaces;
- partial failure;
- state-changing step without current authority denied;
- retry/restart/idempotency;
- version history;
- semantic ambiguity fails closed;
- secrets/private data remain bounded.

### AW2.20 — Production E2E / live acceptance
Required live scenario:
1. an existing daily automation sends a message at 07:00;
2. user instructs SG to add fresh activity information from groups/workspaces where SG/user has authorized access;
3. SG modifies the existing automation rather than creating a duplicate;
4. temporarily move execution to a near time;
5. at runtime SG re-checks authority, collects fresh activity, composes the message and delivers once;
6. verify persisted execution/version/audit evidence;
7. restore 07:00;
8. restart worker/runtime and prove continuity/no duplicate delivery.

## Acceptance gate

Automation 2.0 is CLOSED only when:
- AW2.1–AW2.20 implementation exists;
- CI is green on the exact HEAD;
- production deploy is confirmed;
- the live modification + fresh collection + dynamic delivery scenario passes;
- authority-loss, partial failure, restart and idempotency acceptance pass;
- no existing Identity/Scope, Access, Resource Authority, Action Gate, Credential Manager, Delivery Router, Temporal or Durable Worker invariants are weakened.
