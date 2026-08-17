# SG Automation 2.0 — Executable Workflows Program

Status: IMPLEMENTATION IN PROGRESS — AW2.1–AW2.12 CLOSED / CI-VERIFIED; AW2.13 NEXT

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

### AW2.5 — Autonomous read-only work — IMPLEMENTED / CI-VERIFIED
Approved autonomous read-only workflows can execute without per-occurrence manual confirmation only inside an explicit deterministic policy envelope.

Implementation rules:
- autonomy is typed workflow policy (`executionPolicy.autonomousReadOnly === true`), never phrase/keyword matching;
- per-occurrence confirmation bypass is allowed only when `executionPolicy.confirmationRequired === false` is explicit;
- the autonomous read-only allowlist is closed to `collect`, `retrieve`, `analyze`, `compose`;
- `invoke-capability`, `deliver`, missing/unsupported types and any other step class are denied by the AW2.5 policy;
- every autonomous read-only step must remain explicitly protected (`step.security.protected === true`), so AW2.4 independently re-checks current Identity, access, Resource Authority, Action Gate, credentials and permission health immediately before every handler;
- invalid autonomy policy fails closed before the affected handler is invoked and persists a denied step outcome;
- successful autonomy-policy evidence is merged with the existing per-step security/source evidence;
- workflows that do not request autonomous read-only execution keep their existing behavior, preserving legacy self-notification compatibility;
- no scheduler, queue, worker, authority, credential or confirmation stack is duplicated or bypassed.

Implementation: `src/automation/workflowReadOnlyAutonomy.js`, `src/automation/workflowExecutor.js`, exported through `src/automation/index.js`.
Regression coverage: `tests/workflowReadOnlyAutonomy.test.js` plus existing AW2.3/AW2.4 workflow executor coverage.
Evidence: code HEAD `03dc1903fc17ae605bc96503f1eb2fac8ced8d4d`; SG 2.1 CI #8156 SUCCESS on that exact HEAD.
Boundary: AW2.5 defines and enforces autonomous read-only policy only. It does not introduce state-changing/external autonomous execution; that remains AW2.6.

### AW2.6 — State-changing execution envelope — IMPLEMENTED / CI-VERIFIED
State-changing capability invocation now requires an explicit bounded execution envelope before the handler can be resolved or invoked. The envelope is structural policy only; it never grants runtime authority and never replaces AW2.4.

Implementation rules:
- the current state-changing canonical step class is closed to `invoke-capability`; no keyword/phrase classification is used;
- every such step must remain `security.protected === true`;
- every such step must carry explicit `executionEnvelope.capability`, non-empty `resourceScope`, `actionClass`, `risk`, `confirmationPolicy` and `delegationPolicy`;
- an explicit step capability, when present, must equal the envelope capability;
- `per-execution` confirmation requires workflow `executionPolicy.confirmationRequired === true` and no delegation;
- delegated scheduled execution requires workflow `confirmationRequired === false`, `delegationPolicy === 'bounded'` and an explicit `delegationRef`;
- a valid envelope contributes audit evidence but does not authorize the action: AW2.4 still performs current Identity, access, Resource Authority, Action Gate, credential and permission-health re-checks immediately before the protected handler;
- loss of current authority denies the action even when a stored bounded delegation/envelope remains structurally valid;
- invalid/missing envelope fails closed before the state-changing handler is invoked and persists a denied outcome;
- `deliver` remains on the existing Delivery Router / execution-security boundary and is not reclassified as a generic capability mutation in AW2.6, preserving the established self-notification compatibility path;
- no new scheduler, worker, queue, confirmation service, authority stack, credential path or ACS bypass is introduced.

Implementation: `src/automation/workflowStateChangeEnvelope.js`, `src/automation/workflowExecutor.js`, exported through `src/automation/index.js`.
Regression coverage: `tests/workflowStateChangeEnvelope.test.js` plus the existing AW2.3/AW2.4/AW2.5 executor/security suites.
Evidence: code HEAD `2fbde9b7c427b1fdf95b2605c7bc68bbf7a074d0`; SG 2.1 CI #8167 SUCCESS on that exact HEAD (`npm run check`, web start, worker start and diagnostics all successful).
Boundary: AW2.6 defines and enforces the bounded state-changing execution envelope at the generalized Workflow Executor boundary. It does not production-wire new state-changing capabilities, grant autonomous authority, broaden resource scope, replace existing confirmation/action-gate semantics, or implement automation mutation; AW2.7 owns the automation-update path.

### AW2.7 — Automation update capability — CLOSED / CI-VERIFIED
Canonical `automation-update` now updates an existing automation without changing `automationId` and creates a monotonic workflow version/history entry.

Implemented boundary:
- workflow content and trigger/input/delivery/execution-policy updates are applied to the existing automation;
- pause/resume/cancel and schedule/runtime mutation reuse the existing scheduler;
- recurring updates reuse the existing scheduler; one-shot updates reuse `PostgresTaskQueue`;
- workflow v1 is registered in PostgreSQL before later updates;
- workflow optimistic commit and runtime mutation are atomic in one PostgreSQL transaction;
- production mutation stays behind the existing Capability/Action Gate path and does not bypass Identity, Resource Authority, Action Gate or other security seams;
- zero or multiple structured selector matches fail closed;
- no parallel scheduler, worker, queue or security stack is introduced.

Implementation/evidence:
- `src/automation/workflowUpdate.js` and production automation wiring;
- PostgreSQL workflow update/version persistence and migration;
- regression coverage including `tests/workflowUpdate.test.js`, `tests/workflowUpdateProductionWiring.test.js` and existing scheduler/security suites;
- final compatibility fix preserves legacy self-notification updates when `payload.delivery` is absent via `delivery: payload.delivery ?? {}`;
- closure evidence HEAD `9fb186864071b2039062cfd63ab1e9d56839db85`; SG 2.1 CI #8212 SUCCESS on that exact HEAD.

Boundary: AW2.7 owns canonical mutation of an already deterministically selected automation. It does not make users resolve internal IDs semantically; AW2.8 owns semantic target resolution.

### AW2.8 — Semantic target resolution — CLOSED / CI-VERIFIED
Users no longer need internal `automationId` / `taskId` / `scheduleId` to identify an existing automation for update.

Implemented boundary:
- semantic target attributes are structured (`triggerType`, recurrence, time zone, local time, notification message and lifecycle status), not phrase/keyword routing;
- candidate discovery is bounded to the existing canonical workflow scope in PostgreSQL before matching;
- normalized structured attributes are matched deterministically against existing workflow records;
- exactly one match resolves to the existing canonical `automationId` and then continues through the unchanged AW2.7 authorization/mutation path;
- zero matches fail closed with clarification required;
- multiple matches fail closed with clarification required;
- unsupported/invented selector attributes fail closed rather than being guessed or converted into IDs;
- semantic resolution does not create a new scheduler, worker, queue, security stack or alternate mutation path;
- authorization receives the resolved canonical selector while preserving the originally requested structured selector for bounded evidence/audit context.

Implementation/evidence:
- `src/automation/workflowUpdate.js` — structured semantic selector normalization and deterministic fail-closed resolution;
- `src/automation/postgresWorkflowUpdateStore.js` — bounded candidate listing inside canonical scope;
- `src/automation/index.js` — exported semantic selector contract;
- regression coverage: `tests/workflowSemanticTargetResolution.test.js` covering unique match, zero match, ambiguity, scope isolation and unsupported/invented selector attributes;
- implementation HEAD `3e4aa1732f17f2dd495da219bdd7f490e3dd503e`; SG 2.1 CI #8226 SUCCESS on that exact HEAD (`npm run check`, web start, worker start and diagnostics all successful).

Boundary: AW2.8 resolves only an existing workflow target. It does not broaden authorization, invent target data, perform fuzzy phrase matching, duplicate an automation or change AW2.7 mutation semantics. AW2.9 owns patch-not-duplicate behavior as the next explicit stage.

### AW2.9 — Patch, not duplicate — CLOSED / CI-VERIFIED
Updating an existing automation patches the same canonical workflow/runtime registration instead of creating a second automation, task or schedule.

Implemented boundary:
- `automationId` remains unchanged across update and the workflow version increases monotonically;
- one-shot updates preserve the existing `taskId` and use the existing durable queue `updateScheduled()` path;
- recurring updates preserve the existing `scheduleId` and use the existing scheduler `update()` path;
- content/template synchronization reuses the already-associated durable task rather than creating a second task;
- update is forbidden from using create/register paths; a new `automationId` is only valid through an explicit create/copy flow outside `automation-update`;
- no production runtime rewrite is required because AW2.7 already provides the correct patch semantics.

Implementation/evidence:
- runtime invariants are enforced by `src/automation/workflowUpdate.js` and existing production automation wiring;
- regression coverage: `tests/workflowPatchNotDuplicate.test.js` fails if recurring/one-shot update invokes `create`/`register`, and verifies stable `automationId`, `taskId`, `scheduleId` plus workflow version `1 → 2`;
- initial regression commit `c0205686904d119950733c1fe96c70ed20f3ee59`; corrected public-contract assertion commit `e3d21755f6c8fdcbe88bc53620deaf9c46990d69` on `dev/sg2.1-semantic`;
- closure evidence: SG 2.1 CI #8238 SUCCESS on exact HEAD `e3d21755f6c8fdcbe88bc53620deaf9c46990d69`.

Boundary: AW2.9 adds regression-proof of patch-not-duplicate semantics only. It does not introduce create/copy semantics, rewrite the scheduler/queue, or broaden authorization. AW2.10 owns the next explicit version-history stage.

### AW2.10 — Versioning and history — CLOSED / CI-VERIFIED
Every accepted workflow registration/mutation has an inspectable durable version-history record built on the existing AW2.7 PostgreSQL history mechanism; no parallel version store was introduced.

Implemented boundary:
- monotonic `version` and `previousVersion` form the workflow version chain;
- each history row retains the full canonical workflow snapshot, actor, timestamp and bounded patch summary;
- request/trace provenance and Action Gate result remain persisted with the version;
- canonical workflow validation evidence is now persisted explicitly as `validation_result`, derived from the already-required successful `createWorkflowDefinition()` validation rather than a second validator;
- history inspection returns versions newest-first with workflow snapshot, patch/provenance/validation/gate evidence;
- invalid next workflow definitions fail before commit and therefore create no version-history entry;
- the stored full snapshots provide the evidence substrate for a later safe restore flow, but AW2.10 does not itself add rollback mutation semantics.

Implementation/evidence:
- `src/automation/postgresWorkflowUpdateStore.js` persists and exposes validation evidence alongside the existing version-history fields;
- migration `src/persistence/migrations/907_automation_workflow_version_validation.sql` additively backfills existing valid history and requires `validation_result` for later rows;
- regression coverage: `tests/workflowVersionHistory.test.js` verifies `v1 → v2 → v3`, parent links, actor/timestamp, patch summary, request/trace provenance, validation/gate evidence, full snapshots and no history row for invalid mutation;
- migration baseline coverage in `tests/postgresPersistence.test.js` now includes migration `907`;
- implementation/test HEAD `79fede067c9eec9f15c71008a58848b0fdb7f50c`; SG 2.1 CI #8251 SUCCESS on that exact HEAD, including migration, security gate, `npm run check`, web start, worker start and diagnostics.

Boundary: AW2.10 extends the existing AW2.7 durable history record only. It does not change scheduler/queue/update semantics, create a second validator/version store, or implement restore execution. AW2.11 owns runtime fresh-data collection.

### AW2.11 — Runtime fresh-data collection — CLOSED / CI-VERIFIED
Execution-time collectors fetch current authorized evidence at run time rather than replaying stored prepared text as if it were current data.

Implemented boundary:
- `src/automation/runtimeFreshDataCollection.js` defines the canonical runtime handler for `collect` steps and is exported through `src/automation/index.js`;
- fresh collection is valid only for typed `collect` steps with `security.protected === true` and a current allowed AW2.4 execution-time security verdict;
- the underlying collector receives current task/workflow identity, canonical scope, typed step configuration, current security verdict and trace context;
- stored workflow `inputs` and prior executor `handoff` are deliberately not exposed to the collector, preventing prepared/stale text from being reused as current evidence by this runtime path;
- every workflow execution calls current security and the collector again; result data, source metadata, collection timestamp and evidence references are produced by that occurrence;
- revoked current authority denies the protected step before the collector runs;
- no new scheduler, queue, worker, authority, credential or security stack is introduced.

Implementation/evidence:
- implementation: `src/automation/runtimeFreshDataCollection.js`, exported through `src/automation/index.js`;
- regression coverage: `tests/runtimeFreshDataCollection.test.js` covers fail-closed prerequisites, stale input/handoff isolation, repeated recollection with distinct evidence, security/source evidence merge and authority-revocation denial;
- implementation/test HEAD `d632591712118be652710c94a9c7d145b2bdefd0`; SG 2.1 CI #8261 SUCCESS on that exact HEAD, including migration, Block 19 security gate, `npm run check`, web start, worker start and diagnostics.

Boundary: AW2.11 establishes the generic execution-time fresh-data collection contract only. It does not implement a concrete workspace-activity capability or multi-workspace aggregation. AW2.12 owns Workspace Activity Collector.

### AW2.12 — Workspace Activity Collector — CLOSED / CI-VERIFIED
The concrete read-only `workspace-activity` capability now collects deterministic current/persisted evidence for exactly one canonical authorized Telegram workspace through the existing AW2.11 fresh-data runtime seam.

Implemented boundary:
- the collector accepts one canonical TWM `workspaceId` and reuses existing `assertWorkspaceId`; multi-workspace input/aggregation is not implemented here;
- collection requires the current execution-time allowed security verdict and composes with the existing protected `collect` handler, so prepared workflow inputs/prior handoff are not substitutes for current evidence;
- publication counts come from authoritative `content.published` activity events within the requested event-time window;
- poll/test counts reuse the existing PostgreSQL workspace domain-record store;
- interaction metrics reuse the canonical workspace analytics event set (`poll.answer-update`, `test.completed`);
- activity-event counts are returned deterministically with explicit `{from,to}` data-window metadata, source/persistence metadata and evidence references;
- no scheduler, queue, worker, database, Resource Authority, Action Gate or other security stack is duplicated.

Implementation/evidence:
- `src/automation/workspaceActivityCollector.js`, exported through `src/automation/index.js`;
- existing `src/telegramWorkspace/postgresWorkspaceOperationsStore.js`, `workspaceAnalyticsOperations.js` and `workspaceOperationsContract.js` are reused rather than replaced;
- regression coverage: `tests/workspaceActivityCollector.test.js` covers deterministic metrics/evidence, canonical interaction semantics, denied current security before storage reads, invalid window/canonical-ID rejection, explicit single-workspace boundary and AW2.11 runtime composition without stale-input reuse;
- implementation/test HEAD `874f6a07db09858602e3d1ad344f375aa229a59c`; SG 2.1 CI #8280 SUCCESS on that exact HEAD, including migration, Block 19 security gate, `npm run check`, web start, worker start and diagnostics.

Boundary: AW2.12 implements the concrete single-workspace read-only collector only. AW2.13 owns multi-workspace aggregation with independent current authorization and explicit omission semantics.

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