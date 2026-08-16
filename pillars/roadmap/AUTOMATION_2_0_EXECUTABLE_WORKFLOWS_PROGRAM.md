# SG Automation 2.0 — Executable Workflows Program

Status: IMPLEMENTATION IN PROGRESS — AW2.1–AW2.4 IMPLEMENTED / CI-VERIFIED; AW2.5 NEXT

## Goal

Upgrade the existing SG durable automation substrate from static self-notifications and schedule-only updates into versioned executable workflows that SG can create, semantically identify, patch, execute, observe and safely deliver.

Automation 2.0 is a cross-cutting program. It reuses Block 9 Automation & Agents, Block 13 Durable Automation & Workers, Temporal Context, Capability System, Identity/Scope, Access Control, Resource Authority, Action Gate, Credential Manager, Delivery Router, PostgreSQL and Observability. It does not create parallel infrastructure.

## Implementation stages

### AW2.1 — Workflow contract — IMPLEMENTED / CI-VERIFIED
- Define `automationId`, `version`, `trigger`, `steps`, `inputs`, `delivery`, `executionPolicy`, scope and provenance.
- Preserve backward compatibility for existing `self-notification` tasks.
- Add schema/version guards.
- Implementation: `src/automation/workflowContract.js`, exported through `src/automation/index.js`.
- Regression coverage: `tests/automationWorkflowContract.test.js`.
- Evidence: implementation commit `0b45ede3516f60ca38b4b748263f914d71d33405`; SG 2.1 CI #8104 SUCCESS on that exact HEAD.
- Boundary: AW2.1 defines and adapts the workflow contract only. It does not yet execute generalized workflow steps or replace the existing scheduler/queue/worker/authorization stack.

### AW2.2 — Canonical step types — IMPLEMENTED / CI-VERIFIED
- Canonical types: `collect`, `retrieve`, `analyze`, `compose`, `invoke-capability`, `deliver`.
- Missing or unsupported step types fail closed.
- `createWorkflowStep()` normalizes and recursively freezes bounded JSON-compatible step metadata.
- `createWorkflowDefinition()` validates every ordered step against the canonical step-type contract.
- Implementation: `src/automation/workflowContract.js`, exported through `src/automation/index.js`.
- Regression coverage: `tests/automationWorkflowContract.test.js`.
- Evidence: implementation commit `251e7b73253eb8f05b4a07563c7087568c234bea`; SG 2.1 CI #8116 SUCCESS on that exact HEAD.
- Boundary: AW2.2 defines step semantics/contracts only. It does not execute steps, persist per-step runtime state, or introduce any parallel scheduler/worker/security stack.

No phrase/keyword routing is allowed as workflow semantics.

### AW2.3 — Workflow Executor — IMPLEMENTED / CI-VERIFIED
- Executes canonical workflow steps strictly in definition order.
- Passes bounded JSON-compatible output/evidence handoff to the following step.
- Persists per-step `running` and terminal state, bounded outputs/evidence references and errors in PostgreSQL.
- Supports `completed`, `partial`, `failed`, `denied`, `cancelled` outcomes; terminal outcomes stop following steps.
- Implementation: `src/automation/workflowExecutor.js`, `src/automation/postgresWorkflowExecutionStore.js`, migration `src/persistence/migrations/905_automation_workflow_execution.sql`, exported through `src/automation/index.js`.
- Regression/integration coverage: `tests/automationWorkflowExecutor.test.js`, `tests/postgresWorkflowExecutionStore.test.js`, migration baseline coverage in `tests/postgresPersistence.test.js`.
- Evidence: code HEAD `50eb46cd6d1d68e1a9301b64c90a5ed3eb0a80eb`; SG 2.1 CI #8132 SUCCESS on that exact HEAD.
- Boundary: AW2.3 does not create a second scheduler/worker and does not production-wire generalized workflows ahead of execution-time security/outcome mapping. Existing `self-notification` execution remains on its established durable/security/delivery path. AW2.4 owns execution-time security re-checks.

### AW2.4 — Execution-time security — IMPLEMENTED / CI-VERIFIED
For every explicitly protected workflow step, immediately before its handler/side effect, execution now re-checks in deterministic fail-closed order:
- Identity/Global ID;
- SG access/entitlement;
- Resource Ownership & Authority;
- Action Gate;
- Credential/connection availability;
- capability/resource permission health.

Implementation rules:
- protected semantics are typed metadata (`step.security.protected === true`), never phrase/keyword matching;
- each protected step is re-checked independently at execution time; creation-time authority is never reused as permanent execution authority;
- missing or throwing runtime security is denied before the protected handler is resolved/invoked;
- the first current denial stops remaining security checks, denies the step and stops following workflow steps;
- successful security evidence is merged into persisted per-step evidence;
- unprotected legacy steps keep existing behavior, preserving the established self-notification path;
- no second scheduler, queue, worker, authority stack or credential path is introduced.

Implementation: `src/automation/workflowExecutionSecurity.js`, `src/automation/workflowExecutor.js`, exported through `src/automation/index.js`.
Regression coverage: `tests/workflowExecutionSecurity.test.js`, `tests/automationWorkflowExecutor.test.js`.
Evidence: code HEAD `9dece1b1f1b0ff277575453a7d7191ad1789c2a2`; SG 2.1 CI #8145 SUCCESS on that exact HEAD.
Boundary: AW2.4 adds the mandatory execution-time security seam at the Workflow Executor boundary. It does not create generalized production workflow composition ahead of later Automation 2.0 stages and does not replace existing Identity, Access, Resource Authority, Action Gate, Credential Manager, ACS, Durable Worker or Delivery Router implementations.

### AW2.5 — Autonomous read-only work — NEXT
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
