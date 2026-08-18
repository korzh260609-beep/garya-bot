# SG Automation 2.0 — Executable Workflows Program

Status: IMPLEMENTATION IN PROGRESS — AW2.1–AW2.19 CLOSED / CI-VERIFIED; AW2.20 PRODUCTION-WIRED / CI-VERIFIED; LIVE ACCEPTANCE PENDING

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

### AW2.13 — Multi-workspace aggregation — CLOSED / CI-VERIFIED
Aggregate across multiple currently authorized workspaces while checking each resource independently. Lost/unavailable resources are explicit omissions rather than invented zeroes.

Implemented boundary:
- `src/automation/multiWorkspaceActivityAggregator.js` composes over the existing AW2.12 single-workspace collector instead of replacing it;
- requested workspace identifiers must be non-empty, canonical and unique, and cannot be mixed with a single `source.workspaceId`;
- each workspace is independently re-checked through the current protected-step security seam before any collection;
- denied workspaces are never read and are returned with explicit omission evidence;
- authorized but unavailable workspaces become explicit omissions instead of fabricated zero metrics;
- totals include only additive authoritative metrics from included workspaces; workspace-local `uniqueActors` remains per-workspace and is not summed as a global unique count;
- the AW2.11 runtime composition continues to exclude stale workflow inputs and prior handoff from collector context;
- no scheduler, queue, worker, AW2.12 collector or security stack is duplicated or rewritten.

Implementation/evidence:
- `src/automation/multiWorkspaceActivityAggregator.js`, exported through `src/automation/index.js`;
- regression coverage: `tests/multiWorkspaceActivityAggregator.test.js` covers independent per-workspace security, authorized-only aggregation, denied/unavailable omissions, non-additive `uniqueActors`, fail-closed scope validation and AW2.11 composition;
- implementation/test HEAD `69e7918dcda9d6bd421d0f3fe3dd74bb7418ef4f`; SG 2.1 CI #8286 SUCCESS on that exact HEAD.

Boundary: AW2.13 provides deterministic multi-workspace collection/aggregation only. It does not compose the final user-facing output; AW2.14 owns dynamic composition.

### AW2.14 — Dynamic composition — CLOSED / CI-VERIFIED
Compose the final user-facing result at execution time from current runtime step outputs while keeping deterministic facts outside AI control.

Implemented boundary:
- `src/automation/runtimeDynamicComposition.js` provides the protected runtime handler for canonical `compose` steps;
- the handler accepts only an untruncated immediate runtime handoff from a completed/partial `collect`, `retrieve` or `analyze` step and does not treat stored workflow inputs as current evidence;
- current data-window metadata, additive totals, per-workspace `uniqueActors` and denied/unavailable omissions are rendered deterministically from the authoritative runtime result;
- partial source outcome and source evidence remain explicit in the composed result;
- deterministic mode invokes no AI;
- optional AI-assisted mode calls only the existing AI Router with task `response-composition`, fixed reason `automation-dynamic-composition`, bounded output, trace/request provenance and existing telemetry/policy/cost enforcement;
- AI may provide only a neutral numeric-free introduction; it neither receives nor rewrites metric values, and numeric AI claims fail closed;
- no scheduler, queue, worker, collector, security stack, AI provider path or cost logger is duplicated.

Implementation/evidence:
- `src/automation/runtimeDynamicComposition.js`, exported through `src/automation/index.js`;
- regression coverage: `tests/runtimeDynamicComposition.test.js` covers runtime-source enforcement, stale-input exclusion, deterministic metrics, workspace-local unique actors, partial omissions, AI Router reason/cost/trace evidence, numeric-claim rejection and prerequisite failures;
- implementation/test HEAD `dba4da3defd8ec692e7083d85403792491640404`; SG 2.1 CI #8290 SUCCESS on that exact HEAD.

Boundary: AW2.14 owns runtime composition only. It does not define retry/backoff or delivery-failure handling; AW2.15 owns failure and retry policy.

### AW2.15 — Failure and retry policy — CLOSED / CI-VERIFIED
Deterministic result classification now prevents failed work from being completed and routes only explicitly temporary failures into the existing bounded durable retry path.

Implemented boundary:
- completed results are accepted; partial source/resource results are accepted with explicit `partial-resource-failure` classification rather than silently presented as complete data;
- lost authority/denial, cancellation, invalid/ambiguous results and permanent capability failures are terminal and non-retryable;
- API/provider or capability failure is retryable only when explicitly marked `retryable === true`;
- final delivery must expose an explicit delivered/completed status; missing or failed delivery cannot become task success, and temporary delivery failure retains its retryable flag;
- Workflow Executor preserves structured retryability on failed terminal results and marks security/policy denials non-retryable;
- durable worker evaluates the returned result before calling `queue.complete`; rejected results are converted into typed errors and handed to the existing `PostgresTaskQueue.fail` path;
- existing PostgreSQL queue semantics remain authoritative for bounded attempts, exponential backoff cap, explicit deferral, lease recovery and DLQ evidence;
- unsupported production task kinds are explicitly permanent;
- no parallel scheduler, queue, worker, retry service or DLQ is introduced.

Implementation/evidence:
- `src/automation/workflowFailurePolicy.js`, exported through `src/automation/index.js`;
- `src/automation/durableWorker.js`, `workflowExecutor.js` and `productionWorkerExecution.js` integrate the policy into existing runtime seams;
- regression coverage: `tests/workflowFailureRetryPolicy.test.js` plus existing `tests/durableWorkers.test.js` covers partial, authority loss, temporary/permanent failure, delivery failure, false-success denial, bounded queue reuse, exponential backoff, attempt exhaustion, lease recovery and DLQ;
- implementation/test HEAD `abbb90f6a9b2b50282cdc6f9a04e7dd3ed1e0017`; SG 2.1 CI #8294 SUCCESS on that exact HEAD.

Boundary: AW2.15 defines execution failure/retry semantics and reuses existing durable persistence. It does not add the complete per-run history record; AW2.16 owns execution history.

### AW2.16 — Execution history — CLOSED / CI-VERIFIED
Every Workflow Executor run now has a durable inspectable identity and ordered evidence history instead of only the latest step state for a task.

Implemented boundary:
- migration 908 creates `automation_workflow_runs` and append-only `automation_workflow_run_events`, backfills existing step records and gives each step snapshot a `run_id`;
- run identity includes run, task, automation, workflow version, occurrence, attempt, trace and request IDs;
- run terminal state preserves completed/partial/failed/denied/cancelled outcome, bounded output/evidence, error code/message and retryability;
- step transitions persist per run without later occurrences or retry attempts overwriting earlier history;
- typed run events capture current source metadata and omissions, protected-step gate decisions, AI provider/model/cost/reason/trace evidence and final delivery status/failure evidence;
- Workflow Executor starts and completes history around the existing execution path and closes thrown exceptions as failed runs;
- execution history can be inspected by run or listed by automation in deterministic order and survives PostgreSQL restart;
- existing observability remains the system-wide telemetry/audit channel; AW2.16 extends the existing workflow execution store rather than replacing observability or creating a second workflow executor.

Implementation/evidence:
- `src/persistence/migrations/908_automation_workflow_execution_history.sql`;
- `src/automation/postgresWorkflowExecutionStore.js` and `workflowExecutor.js`;
- regression coverage: `tests/workflowExecutionHistory.test.js` plus migration coverage in `tests/postgresPersistence.test.js`;
- implementation/test HEAD `3f07b629dcbb0f75e92a1288acfd2d37bf6ef6f3`; SG 2.1 CI #8300 SUCCESS on that exact HEAD.

Boundary: AW2.16 records occurrence/attempt identity supplied to execution but does not yet guarantee stable occurrence derivation, exactly-once delivery or restart replay safety; AW2.17 owns those idempotency and continuity guarantees.

### AW2.17 — Idempotency and restart continuity — CLOSED / CI-VERIFIED
Each durable occurrence now carries one stable identity across scheduler replay, retry attempts and worker restarts, and every delivery step derives its idempotency key from that occurrence rather than an attempt.

Implemented boundary:
- one-shot task submission persists a stable occurrence identity; recurring registration/materialization persists deterministic `schedule:<scheduleId>:<sequence>` identity for the template first occurrence and every later occurrence;
- existing scheduler task/idempotency conflicts remain authoritative, so replaying materialization cannot create a second durable occurrence task;
- `createRestartContinuousWorkflowExecution` resolves the exact pinned `automationId@version` snapshot from durable workflow history on every worker process, fails closed when it is missing/mismatched and never drifts to a newer workflow after restart;
- Workflow Executor passes occurrence/attempt and the stable per-delivery-step key to runtime security and handlers while retaining distinct attempt run history;
- legacy self-notification delivery now uses the same occurrence-derived key and records occurrence evidence in Delivery Router metadata;
- Delivery Router retries durable records only when explicitly retryable, reuses their original delivery identity/key, returns completed delivery as a duplicate without calling the external adapter again and never downgrades an already delivered PostgreSQL record;
- external transport adapters receive the stable idempotency key on every ambiguous retry, preserving their provider-side replay protection;
- no scheduler, queue, worker, workflow store, Delivery Router or retry stack is duplicated.

Implementation/evidence:
- `src/automation/workflowExecutionContinuity.js`, `postgresRecurringScheduler.js`, `postgresTaskQueue.js`, `workflowExecutor.js`, `productionWorkerExecution.js` and exact-version resolution in `postgresWorkflowUpdateStore.js`;
- durable delivery continuity in `src/delivery/deliveryRouter.js` and `postgresDeliveryStore.js`;
- regression coverage in `tests/workflowRestartContinuity.test.js` plus the updated self-notification compatibility assertion;
- implementation/test HEAD `3bf821f20e031827e9f74a877c3b8610aebd24c7`; SG 2.1 CI #8306 SUCCESS on that exact HEAD.

Boundary: AW2.17 closes occurrence, materialization, exact-version restart and delivery idempotency continuity. Natural-language lifecycle operations, including restore of an earlier version, remain AW2.18.

### AW2.18 — Natural-language lifecycle — CLOSED / CI-VERIFIED
Existing executable workflows can now be modified by semantic lifecycle meaning through a strict typed operation contract, while deterministic runtime code owns validation, target uniqueness, authorization and mutation.

Implemented boundary:
- semantic interpretation emits one of `add-step`, `remove-step`, `replace-workflow`, `change-output-style`, `change-trigger`, `pause`, `resume`, `cancel` or `restore-version` through the existing `automation-update` capability;
- no exact phrase/keyword list is used as the lifecycle mechanism; the AI semantic boundary may express only structured facts actually present in the request;
- existing AW2.8 scoped selector resolution still identifies exactly one current automation before the operation is compiled;
- unsupported fields, ambiguous type-only step targets, invalid versions and unavailable historical snapshots fail closed;
- add/remove/replace/style/trigger keep the canonical `automationId`, validate a complete next workflow and append its monotonic version through the existing AW2.7 atomic mutation path;
- restore materializes an earlier canonical snapshot as a new current version, preserving history and `automationId`, and records the source version in provenance/patch evidence;
- every mutation remains behind the existing production Capability/Action Gate path, with current actor/scope and gate result persisted;
- recurring lifecycle continues through the existing scheduler; one-shot pause/resume/cancel reuses scoped transactional transitions in the existing PostgreSQL task queue;
- AW2.12 collectors, scheduler, queue, worker, identity, authority, credential and security stacks are not duplicated or rewritten.

Implementation/evidence:
- `src/automation/workflowNaturalLanguageLifecycle.js`, integration in `workflowUpdate.js`, `productionCapabilities.js`, `productionMeaningInterpreter.js`, `postgresTaskQueue.js` and exports in `src/automation/index.js`;
- regression coverage: `tests/workflowNaturalLanguageLifecycle.test.js` covers semantic add/remove/replace/style/trigger, stable automation identity and versions, historical restore, recurring/one-shot pause-resume-cancel, fail-closed ambiguity/invalid restore and PostgreSQL scope/durability;
- implementation/test HEAD `3361e24c4a6f8bb103206a15cedf4896c077a9f1`; SG 2.1 CI #8310 SUCCESS on that exact HEAD.

Boundary: AW2.18 closes natural-language lifecycle and restore inside the existing deterministic mutation/security/runtime seams. It does not replace AW2.19 consolidated regression/security closure or AW2.20 production live acceptance.

### AW2.19 — Regression and security tests — CLOSED / CI-VERIFIED
The complete CI suite now provides one consolidated regression/security gate for the executable-workflow invariants established in AW2.4–AW2.18.

Covered matrix:
- patch existing automation and preserve the canonical identity: `tests/workflowPatchNotDuplicate.test.js`, `tests/workflowNaturalLanguageLifecycle.test.js`;
- no duplicate task/schedule registration: `tests/workflowPatchNotDuplicate.test.js`;
- current runtime collection and stored-input/handoff isolation: `tests/runtimeFreshDataCollection.test.js`, `tests/automationWorkflowRegressionSecurity.test.js`;
- lost authority after creation and state-changing execution without current authority denied: `tests/workflowExecutionSecurity.test.js`, `tests/workflowStateChangeEnvelope.test.js`;
- independent multi-workspace authority, authorized-only aggregation and explicit omissions: `tests/multiWorkspaceActivityAggregator.test.js`;
- honest partial failure and deterministic temporary/terminal retry classification: `tests/workflowFailureRetryPolicy.test.js`;
- retry/restart/occurrence and delivery idempotency continuity: `tests/workflowRestartContinuity.test.js`;
- monotonic version history and invalid-mutation rejection: `tests/workflowVersionHistory.test.js`;
- semantic lifecycle ambiguity and invalid restore fail closed: `tests/workflowNaturalLanguageLifecycle.test.js`;
- Credential Manager raw-secret callback confinement, public/audit exclusion, cross-scope denial before secret read, unsafe metadata rejection, bounded/redacted current-security snapshots and private fresh-data isolation: `tests/automationWorkflowRegressionSecurity.test.js`.

Security boundary:
- `src/automation/workflowExecutionSecurity.js` sanitizes snapshot evidence before it can reach handlers/history, with explicit depth, entry and string bounds, recursive freezing and sensitive/private key redaction;
- canonical `allowed`, `reason`, `evidenceRefs` and bounded non-sensitive snapshot evidence remain available;
- raw credentials continue to be resolved only through the existing Credential Manager callback boundary;
- no scheduler, queue, worker, workflow store, Identity, Resource Authority, Action Gate, Credential Manager, Delivery Router or security stack is duplicated or bypassed.

Implementation/evidence:
- implementation/test HEAD `7af9a9285142e25a73fe4ac792382ac86360051e`;
- SG 2.1 CI #8314 SUCCESS on that exact HEAD, including migration, Block 19 security gate, `npm run check`, web start, worker start and diagnostics.

Boundary: AW2.19 closes code/CI regression and security coverage only. It is not deployment or live runtime proof; AW2.20 owns production E2E and live acceptance.

### AW2.20 — Production E2E / live acceptance — PRODUCTION-WIRED / CI-VERIFIED; LIVE ACCEPTANCE PENDING

Production implementation/evidence:
- `src/automation/productionExecutableWorkflowRuntime.js` assembles the existing pinned-version continuity, Workflow Executor, current execution security, AW2.11–AW2.14 collection/composition, Delivery Router and AW2.16 execution-history seams inside the Render web application runtime;
- `src/automation/productionWorkerExecution.js` routes workflow-backed `self-notification` tasks to that runtime while retaining the legacy static-message path for tasks without a workflow reference and failing closed when the executable runtime is unavailable;
- `src/runtime/renderWebApplication.js` injects the existing PostgreSQL workflow/version and execution stores, TWM operations store, live workspace authority, bot permission health, canonical Action Gate, Credential Manager, AI Router and Delivery Router into the existing embedded durable worker;
- multi-workspace child rechecks inherit only the sanitized parent identity snapshot and still perform an independent force-fresh authority/permission check for each canonical workspace;
- `tests/automationProductionE2E.test.js` proves pinned version resolution, current per-workspace reauthorization, denied-workspace omission without data reads, fresh deterministic composition, persisted gate/source/delivery/run evidence, worker routing, fail-closed missing runtime and restart-safe occurrence delivery idempotency;
- implementation HEAD `27cd4442f5057c071d881a9d8f79faaf95b54bcb` passed exact-head SG 2.1 CI #8317;
- no scheduler, queue, durable worker, workflow store, Identity, Resource Authority, Action Gate, Credential Manager, Delivery Router or security stack was replaced or duplicated.

First deployed live attempt, 2026-08-18:
- the operator confirmed deployment and invoked the required modification using “groups where you are”;
- SG refused instead of updating because the semantic contract could not express a safe current-authorized workspace set and `add-step` could not atomically produce the required collect → dynamic compose chain;
- the remediation adds the typed `add-workspace-activity` operation, symbolic `authorized-current` execution-time resolution, preserved original notification text, current authority filtering plus AW2.13 per-workspace rechecks, user-facing workspace titles instead of internal IDs, and end-to-end regression coverage;
- this is a live-found defect remediation, not final acceptance: exact-head CI, re-deploy and the complete live scenario below are still mandatory.

Boundary: this closes the production code/CI wiring gap only. It does not prove a Render deploy or the real Telegram live scenario below, so AW2.20 and Automation 2.0 remain NOT CLOSED.

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
