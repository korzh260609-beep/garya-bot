# SG 2.1 — CANONICAL CURRENT STATUS

## Purpose

This file is the canonical **current-status index** for `dev/sg2.1-semantic`.

Large roadmap/program documents preserve implementation plans, acceptance contracts and historical sequencing. Their old lifecycle labels may therefore describe the state when that specification was written. When a status label conflicts with newer implementation/CI/live evidence, this file and the stronger evidence chain below determine current state; the older document remains useful for requirements and history.

## Evidence priority

For current-state claims use, in order:

```text
live runtime evidence
→ current working-branch HEAD + CI on that exact HEAD
→ actual production wiring + tests
→ current evidence/status documents
→ README / roadmap program prose
→ historical checkpoints / old / archive
```

Never silently promote evidence:
- code/CI is not deployment;
- deployment is not live verification;
- historical evidence is not current state;
- a roadmap statement is not proof that code exists;
- AI/model output is not authority or verification.

When evidence conflicts, report the conflict and qualify the weaker/stale source.

## Working branch

- Repository: `korzh260609-beep/garya-bot`
- SG 2.1 working/deployment branch: `dev/sg2.1-semantic`
- `main` is not the SG 2.1 working branch.
- HEAD/CI are dynamic and must be re-read from GitHub before any current implementation/deployment conclusion.

## Core numbered blocks

### Block 16.18 — Monarch Control / Owner Security

**IMPLEMENTED / WIRED / CI-VERIFIED — NOT FORMALLY CLOSED.**

Actual production code includes canonical owner identity binding, owner-only capability policy, fail-closed mismatch/unconfigured behavior, lockdown/rate limiting/audit and composition with the existing Action Gate. Formal closure remains governed by the explicit acceptance checklist.

Canonical docs:
- `16_18_MONARCH_CONTROL_OWNER_SECURITY.md`
- `../architecture/MONARCH_OWNER_SECURITY.md`

### Block 17 — Render Deployment

**IMPLEMENTATION COMPLETE / LIVE WEB-RUNTIME EVIDENCE PRESENT — NOT FORMALLY CLOSED.**

Real Telegram acceptance proves the Render-hosted SG 2.1 web runtime has been deployed and operational. This does not automatically prove the remaining worker/restart/rollback closure evidence.

Canonical doc: `17_RENDER_DEPLOYMENT.md`.

### Blocks 18–19

**COMPLETED / ACCEPTANCE-VERIFIED** according to their canonical roadmap/evidence records.

## Automation 2.0 — Executable Workflows

**ACCEPTED ARCHITECTURE / IMPLEMENTATION IN PROGRESS — AW2.1–AW2.19 CLOSED / CI-VERIFIED; AW2.20 PRODUCTION-WIRED / CI-VERIFIED; DEPLOYMENT CONFIRMED; LIVE ACCEPTANCE FOUND AND REMEDIATED A NATURAL-LANGUAGE WORKSPACE-SELECTION GAP; RE-DEPLOY / LIVE RE-TEST PENDING.**

AW2.1–AW2.12 now provide the additive generalized workflow foundation above the existing durable automation substrate:
- versioned workflow contract and backward-compatible `self-notification` adapter;
- six canonical step types (`collect`, `retrieve`, `analyze`, `compose`, `invoke-capability`, `deliver`);
- ordered Workflow Executor with bounded handoff and persisted per-step outcomes/evidence;
- execution-time protected-step security re-checks through existing Identity, access, Resource Authority, Action Gate, Credential Manager and permission-health seams;
- explicit autonomous read-only policy closed to `collect`/`retrieve`/`analyze`/`compose`, with every autonomous step still protected by current runtime security;
- bounded AW2.6 state-changing execution envelope for `invoke-capability`, requiring explicit capability, resource scope, action class, risk and confirmation/delegation semantics before handler invocation;
- canonical AW2.7 `automation-update` path that mutates the same `automationId`, creates monotonic PostgreSQL workflow versions/history, atomically commits workflow/runtime mutation, and reuses the existing scheduler/PostgresTaskQueue;
- AW2.8 structured semantic target resolution inside canonical scope, selecting exactly one existing automation without requiring the user to know internal IDs;
- AW2.9 regression coverage proving updates reuse the same canonical automation/task/schedule registrations and do not create/register duplicates;
- AW2.10 durable version-history evidence covering version/parent, actor, timestamp, patch summary, request/trace provenance, canonical validation result, gate result and full workflow snapshots;
- AW2.11 execution-time fresh-data `collect` handler contract that requires a current allowed protected-step security verdict, performs collection anew per execution and does not expose stored workflow inputs/prior handoff to the collector as substitute current evidence;
- AW2.12 concrete single-workspace `workspace-activity` collector that reuses existing TWM persisted activity/analytics semantics, requires current execution security and returns deterministic publication/poll/test/interaction/activity-event evidence with explicit data-window/source metadata;
- AW2.13 multi-workspace aggregation over AW2.12 with independent current security re-check per canonical workspace, explicit denied/unavailable omissions, authorized-data-only additive totals and no invalid cross-workspace summation of `uniqueActors`;
- AW2.14 runtime `compose` handler that builds final user-facing output from the immediately preceding current execution result, preserves partial/omission evidence, renders authoritative metrics deterministically and permits optional narrative only through the existing cost/reason/trace-logged AI Router;
- AW2.15 deterministic durable-result boundary that accepts honest partial completion, prevents failed/denied/delivery-failed results from becoming false success, classifies terminal versus explicitly temporary failures and reuses the existing PostgreSQL queue bounded exponential backoff/DLQ path;
- AW2.16 durable per-run execution history keyed by run/occurrence/attempt with ordered step transitions, source evidence, gate decisions, AI provider/model/cost/reason provenance, delivery result and terminal output/error evidence;
- AW2.17 stable persisted occurrence identity, replay-safe scheduler materialization, exact pinned workflow-version resolution after restart and occurrence-derived durable Delivery Router idempotency;
- AW2.18 typed natural-language lifecycle operations routed through the existing semantic interpreter, `automation-update`, Action Gate, scoped resolution and atomic workflow/runtime mutation, including restore as a new version;
- AW2.19 consolidated regression/security evidence across AW2.4–AW2.18, with credential scope/secret isolation and bounded/redacted execution-security snapshots;
- AW2.20 production code wiring from the existing durable worker through exact pinned workflow resolution, current per-workspace security, fresh collection, runtime composition, Delivery Router and durable execution history; deployment is operator-confirmed, while Telegram acceptance remains pending.
- the first deployed Telegram modification attempt on 2026-08-18 correctly exposed a remaining gap: the semantic layer refused “groups where you are” because no safe symbolic current-authorized workspace selector and no compound collect/compose mutation existed;
- the remediation adds typed `add-workspace-activity` compilation, execution-time `authorized-current` resolution, independent per-workspace rechecks, preserved notification text, title-based user output and regression coverage; AW2.20 remains NOT CLOSED until exact-head CI, re-deploy and the full live scenario pass.
- the next deployed live attempt reached `automation-update` but exposed a second contract gap: ambiguous/not-found target clarification was replaced by a generic capability failure, while the interpreter-emitted numbered selector was not accepted by workflow update;
- the follow-up remediation preserves fail-closed ambiguity, returns a localized “first or second” clarification without internal IDs, and resolves an explicit position using the same visible recurring-schedule order. Exact-head CI, re-deploy and live re-test remain required.
- after exact-head deployment, the single-target live retry exposed a third defect: the general conversational guidance preceded the specialized automation mutation rule, so the AI interpreter could misroute the executable request to `compose-answer` and invent unsupported limitations; the remediation moves the executable automation contract to the highest-priority start of the semantic boundary and adds the exact live-message regression. Re-deploy and live acceptance remain required.
- the next exact-head live retry reached `automation-update`, but the interpreter over-constrained the target by treating the short unquoted words after “07:00” as the complete stored notification message; exact conjunction then produced zero matches. The remediation keeps the explicitly expressed wall-clock time as the selector and permits a message selector only when the user clearly identifies the full existing message. Ambiguity remains fail-closed.
- live listing then exposed the deeper UX defect: an ordinary request for current tasks included cancelled history, and workflow target resolution also treated cancelled duplicates as mutation candidates. Default listing is now active-only, while explicit status requests retain history access; ordinary updates resolve against operational lifecycle states. Free-form target descriptions are now supported without IDs or list positions: one confident scoped match changes directly, while weak or tied evidence fails closed with human-readable message/time distinctions.
- the next live retry exposed two remaining production UX defects: `task-list` returned only an English count (`Tasks: 50`) instead of current task descriptions, and an exact unique 07:00 target could still be rejected when an additional AI-generated description was imperfect. The runtime now returns a localized human-readable active-task list by default (terminal history only on explicit request), and a unique match from explicit structured evidence such as time is accepted directly; description ranking is used to disambiguate multiple candidates. Exact-head CI, deploy and live acceptance remain required.
- live after that change proved the list was still sourced from legacy execution rows (`unknown`, raw UTC dates and `stopped`) and that pre-workflow active schedules were absent from semantic update resolution. Production task listing now prefers canonical workflow records; legacy operational recurring schedules are scoped, lazily adopted into the existing workflow/version store, then become listable and updateable without changing task/schedule identity. Cancelled/stopped history remains hidden by default. Exact-head CI, deploy and live acceptance remain required.

AW2.6 does **not** turn the stored envelope into authority. A structurally valid state-changing step still passes the existing AW2.4 runtime checks immediately before its handler, so lost access/authority, Action Gate denial, unavailable credentials or permission-health failure remains terminally denied. Scheduled/delegated execution cannot broaden current authorization. No second scheduler, queue, worker, identity, authority, credential, confirmation or ACS stack was created.

AW2.7 implementation/closure evidence:
- `src/automation/workflowUpdate.js` implements deterministic existing-automation mutation and workflow versioning;
- recurring updates reuse the existing scheduler and one-shot updates reuse the existing `PostgresTaskQueue`;
- workflow v1 registration and later optimistic version commits persist in PostgreSQL;
- workflow optimistic commit and runtime mutation execute atomically in one PostgreSQL transaction;
- production `automation-update` remains behind the existing Capability/Action Gate path and does not bypass Identity, Resource Authority, Action Gate or other security seams;
- regression coverage includes AW2.7 workflow-update, production-wiring, scheduler, persistence and security cases;
- the final legacy compatibility regression was fixed with `delivery: payload.delivery ?? {}`;
- code HEAD `9fb186864071b2039062cfd63ab1e9d56839db85` passed exact-head SG 2.1 CI #8212.

AW2.8 implementation/closure evidence:
- semantic target attributes are normalized as structured workflow fields (`triggerType`, recurrence, time zone, local time, notification message and lifecycle status), never phrase/keyword routing;
- PostgreSQL candidate discovery is bounded to the current canonical workflow scope before any target match;
- exactly one structured match resolves to the existing canonical `automationId` and continues through the unchanged AW2.7 Capability/Action Gate mutation path;
- zero or multiple matches fail closed with clarification required;
- unsupported/invented selector fields fail closed instead of being guessed;
- regression coverage in `tests/workflowSemanticTargetResolution.test.js` covers unique resolution, zero match, ambiguity, scope isolation and invented/unsupported selector rejection;
- implementation HEAD `3e4aa1732f17f2dd495da219bdd7f490e3dd503e` passed exact-head SG 2.1 CI #8226, including `npm run check`, web start, worker start and diagnostics.

AW2.9 implementation/closure evidence:
- runtime preserves `automationId` via canonical workflow patching/versioning in `src/automation/workflowUpdate.js`;
- one-shot trigger mutation reuses the existing `taskId` through `PostgresTaskQueue.updateScheduled()`;
- recurring trigger mutation reuses the existing `scheduleId` through scheduler `update()`;
- content/template synchronization reuses the already-associated durable task;
- `tests/workflowPatchNotDuplicate.test.js` explicitly fails if update invokes task/schedule `create` or `register` paths and verifies stable `automationId`, `taskId`, `scheduleId` plus workflow version `1 → 2`;
- initial regression commit `c0205686904d119950733c1fe96c70ed20f3ee59`; corrected public-contract assertion commit `e3d21755f6c8fdcbe88bc53620deaf9c46990d69`;
- SG 2.1 CI #8238 passed on exact HEAD `e3d21755f6c8fdcbe88bc53620deaf9c46990d69`; AW2.9 is therefore CLOSED / CI-VERIFIED.

AW2.10 implementation/closure evidence:
- existing AW2.7 PostgreSQL workflow history remains the single version-history mechanism; no parallel store was added;
- `src/automation/postgresWorkflowUpdateStore.js` preserves monotonic `version`/`previousVersion`, full canonical snapshots, actor, timestamp, patch summary, request/trace provenance and gate result, and now persists/exposes explicit canonical validation evidence;
- migration `src/persistence/migrations/907_automation_workflow_version_validation.sql` additively backfills valid existing history and makes `validation_result` required for later rows;
- validation evidence records successful existing `createWorkflowDefinition()` canonical validation rather than introducing a second validator;
- `tests/workflowVersionHistory.test.js` covers `v1 → v2 → v3`, parent links, actor/timestamp, patch/provenance, validation/gate evidence, snapshots and rejection without a new history row for invalid workflow mutation;
- `tests/postgresPersistence.test.js` includes migration `907` in the persistence baseline;
- implementation/test HEAD `79fede067c9eec9f15c71008a58848b0fdb7f50c` passed exact-head SG 2.1 CI #8251, including migration, security gate, `npm run check`, web start, worker start and diagnostics; AW2.10 is therefore CLOSED / CI-VERIFIED.

AW2.11 implementation/closure evidence:
- `src/automation/runtimeFreshDataCollection.js` defines the runtime fresh-data `collect` handler contract and is exported through `src/automation/index.js`;
- collection is allowed only for typed `collect` steps with `security.protected === true` and a current `securityVerdict.allowed === true` produced by the existing AW2.4 execution-time security seam;
- the collector receives current task/workflow identity, canonical scope, typed step configuration, current security verdict and trace context, but not stored workflow `inputs` or prior `handoff`, so prepared/stale text cannot be replayed as current evidence by this handler;
- each execution invokes both execution-time security and `collectCurrent` again; fresh `collectedAt`, data/source metadata and evidence references become the step output/evidence;
- revoked runtime authority prevents the collector from being called;
- regression coverage in `tests/runtimeFreshDataCollection.test.js` proves fail-closed prerequisites, no stale-input/handoff exposure, two runs producing distinct fresh evidence, merged security/source evidence and revoked-authority denial;
- implementation/test HEAD `d632591712118be652710c94a9c7d145b2bdefd0` passed exact-head SG 2.1 CI #8261, including migration, Block 19 security gate, `npm run check`, web start, worker start and diagnostics; AW2.11 is therefore CLOSED / CI-VERIFIED.

AW2.12 implementation/closure evidence:
- `src/automation/workspaceActivityCollector.js` implements the concrete read-only `workspace-activity` collector and is exported through `src/automation/index.js`;
- the collector accepts exactly one canonical TWM `workspaceId`, reuses existing `assertWorkspaceId`, and requires a current `securityVerdict.allowed === true`; the AW2.11 protected fresh-data handler remains the runtime security/freshness seam;
- publication counts come from authoritative `content.published` events in the requested event-time window, avoiding record-creation-time substitution for publication time;
- poll/test counts reuse the existing PostgreSQL workspace domain-record store;
- interaction metrics reuse the canonical TWM analytics interaction event set (`poll.answer-update`, `test.completed`), while activity-event counts are returned deterministically with explicit `{from,to}` data-window and source/persistence metadata;
- no parallel scheduler, queue, worker, database, Resource Authority, Action Gate or other security stack was added;
- regression coverage in `tests/workspaceActivityCollector.test.js` proves deterministic evidence/metrics, canonical interaction semantics, denied current security before reads, window/canonical-ID validation, rejection of multi-workspace-shaped input and AW2.11 runtime composition without stale-input reuse;
- implementation/test HEAD `874f6a07db09858602e3d1ad344f375aa229a59c` passed exact-head SG 2.1 CI #8280, including migration, Block 19 security gate, `npm run check`, web start, worker start and diagnostics; AW2.12 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.13 implementation/closure evidence:
- `src/automation/multiWorkspaceActivityAggregator.js` implements aggregation by deriving one canonical AW2.12 collection step per requested workspace and is exported through `src/automation/index.js`;
- every workspace receives an independent current `recheckProtectedStep` decision before collection; denied workspaces are not read and are returned as explicit omissions;
- authorized but unavailable workspaces become explicit `workspace-collection-unavailable` omissions rather than invented zeroes;
- only additive authoritative metrics are totaled; `uniqueActors` remains workspace-scoped and is deliberately not summed across workspaces;
- canonical multi-workspace scope validation fails closed for empty, duplicate, ambiguous or invalid workspace identifiers;
- AW2.11 composition does not expose stored workflow inputs or prior handoff as substitute current evidence;
- regression coverage in `tests/multiWorkspaceActivityAggregator.test.js` proves independent authorization, authorized-only aggregation, omission semantics, no cross-workspace `uniqueActors` sum, fail-closed scope validation and AW2.11 fresh-data composition;
- implementation/test HEAD `69e7918dcda9d6bd421d0f3fe3dd74bb7418ef4f` passed exact-head SG 2.1 CI #8286; AW2.13 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.14 implementation/closure evidence:
- `src/automation/runtimeDynamicComposition.js` implements the protected runtime handler for typed `compose` steps and is exported through `src/automation/index.js`;
- composition accepts only an untruncated runtime handoff from a completed/partial `collect`, `retrieve` or `analyze` step and rejects stored workflow inputs as source evidence;
- exact activity totals, workspace-local `uniqueActors`, data-window metadata and omissions are rendered by deterministic code from the runtime source output;
- partial source outcome remains partial, and source/security evidence is retained through the composition result;
- deterministic mode makes no AI call; optional AI-assisted mode uses only the existing `aiRouter.route` boundary with fixed `automation-dynamic-composition` reason, trace/request provenance, normal telemetry/cost enforcement and bounded output;
- AI produces only a neutral numeric-free introduction and cannot receive or rewrite deterministic metrics; numeric AI claims fail closed before the final message is returned;
- regression coverage in `tests/runtimeDynamicComposition.test.js` covers runtime-only composition, stale-input exclusion, authoritative metrics, per-workspace unique actors, partial omissions, AI Router reason/cost/trace evidence, numeric-claim denial and fail-closed prerequisites;
- implementation/test HEAD `dba4da3defd8ec692e7083d85403792491640404` passed exact-head SG 2.1 CI #8290; AW2.14 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.15 implementation/closure evidence:
- `src/automation/workflowFailurePolicy.js` defines structured result classification for completed, partial-resource-failure, lost-authority, temporary, permanent, delivery, cancelled and invalid-result cases;
- `src/automation/durableWorker.js` evaluates every returned executor result before `queue.complete`; failed, denied, cancelled, ambiguous or undelivered results become typed errors and follow the existing `queue.fail` path;
- honest `partial` workflow outcome remains accepted and explicitly observable rather than retried or mislabeled as full data availability;
- retry occurs only when a returned/raised failure is explicitly `retryable === true`; lost authority, cancellation, invalid results and permanent capability failures are terminal;
- final `deliver` output requires explicit delivered/completed status; missing or failed delivery cannot be marked completed, while temporary delivery failure can use bounded retry;
- `src/automation/workflowExecutor.js` now preserves handler retryability in normalized terminal workflow results; execution-security and policy denials are explicitly non-retryable;
- `src/automation/productionWorkerExecution.js` marks unsupported production task kinds permanent instead of wasting retry attempts;
- existing `PostgresTaskQueue.fail` remains the only durable retry/backoff/DLQ mechanism, retaining bounded `maxAttempts`, exponential delay cap, deferral and dead-letter evidence;
- regression coverage in `tests/workflowFailureRetryPolicy.test.js` covers partial completion, lost authority, temporary/permanent failure, final-delivery false-success prevention, durable-worker queue reuse and ambiguous result denial; existing durable-worker/PostgreSQL tests continue to cover exponential backoff, attempt bounds, lease recovery and DLQ;
- implementation/test HEAD `abbb90f6a9b2b50282cdc6f9a04e7dd3ed1e0017` passed exact-head SG 2.1 CI #8294; AW2.15 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.16 implementation/closure evidence:
- migration `908_automation_workflow_execution_history.sql` additively creates durable workflow runs/events, backfills legacy step runs, and changes step identity from overwrite-prone `(taskId, stepIndex)` to `(runId, stepIndex)`;
- every run records `runId`, canonical `automationId`, workflow version, occurrence, attempt, task, trace/request provenance, lifecycle status, output/evidence, error and retryability;
- `src/automation/postgresWorkflowExecutionStore.js` extends the existing execution store with `startRun`, append-only transition/runtime events, `completeRun`, `getRunHistory` and ordered run listing;
- Workflow Executor opens/closes the run boundary and attaches deterministic run identity to its result while preserving backward compatibility for in-memory step stores;
- protected-step gate decisions, current source metadata/omissions, AI provider/model/cost/reason/trace evidence and final delivery status are persisted as bounded typed run events;
- thrown failures close the run as failed with code/message/retryability; denied/partial/completed workflow results retain their exact terminal status;
- step outputs/evidence remain bounded and each transition is append-only even though the per-run step snapshot is updated to its latest state;
- regression coverage in `tests/workflowExecutionHistory.test.js` verifies full runtime evidence, partial outcome, failure closure and PostgreSQL restart persistence with ordered events;
- migration baseline is 36 and includes migration 908;
- implementation/test HEAD `3f07b629dcbb0f75e92a1288acfd2d37bf6ef6f3` passed exact-head SG 2.1 CI #8300; AW2.16 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.17 implementation/closure evidence:
- one-shot tasks persist `task:<taskId>` occurrence identity and recurring tasks persist deterministic `schedule:<scheduleId>:<sequence>` identity from the first occurrence onward;
- scheduler materialization keeps its existing deterministic task/idempotency conflicts, so a replay cannot create another task for the same occurrence;
- `createRestartContinuousWorkflowExecution` reloads exactly the task-pinned `automationId@version` snapshot through the existing PostgreSQL workflow/version store after each process restart and fails closed on missing/mismatched history;
- Workflow Executor supplies stable occurrence, attempt and per-delivery-step idempotency context while AW2.16 continues to retain a distinct run per attempt;
- production self-notification delivery uses the occurrence-derived key and persists occurrence evidence in Delivery Router metadata;
- retryable durable delivery records retain the same delivery ID/key for another attempt; delivered or terminal records are returned as duplicates without a new transport call;
- PostgreSQL delivery upsert cannot downgrade an already delivered record, and external transport adapters receive the same key on ambiguous retry for provider-side replay protection;
- regression coverage in `tests/workflowRestartContinuity.test.js` verifies stable occurrence derivation, restart with pinned version, retry with the same external key and no redelivery after success;
- implementation/test HEAD `3bf821f20e031827e9f74a877c3b8610aebd24c7` passed exact-head SG 2.1 CI #8306; AW2.17 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.18 implementation/closure evidence:
- `src/automation/workflowNaturalLanguageLifecycle.js` defines a strict typed semantic lifecycle contract for `add-step`, `remove-step`, `replace-workflow`, `change-output-style`, `change-trigger`, `pause`, `resume`, `cancel` and `restore-version`;
- `src/ai/productionMeaningInterpreter.js` maps lifecycle meaning to the existing `automation-update` capability without an exact phrase/keyword table and without inventing selectors, workflow parts, cadence, versions or authority;
- deterministic compilation happens only after existing scoped semantic target resolution; unsupported fields, missing restore snapshots and ambiguous step targets fail closed, with clarification required where the target is not unique;
- every accepted semantic lifecycle mutation remains behind the production Capability/Action Gate path and is atomically committed through the existing AW2.7 workflow/runtime transaction;
- add/remove/replace/style/trigger operations preserve the same canonical `automationId` and create the next monotonic workflow version;
- restore copies the selected earlier canonical snapshot into a new current version, preserves `automationId`, records `restoredFromVersion` and synchronizes the existing runtime trigger rather than moving history backward;
- recurring pause/resume/cancel continues through the existing scheduler; one-shot lifecycle now uses scoped transactional transitions in the existing `PostgresTaskQueue`;
- version provenance, patch summary and Action Gate evidence retain the typed semantic operation;
- regression coverage in `tests/workflowNaturalLanguageLifecycle.test.js` covers all lifecycle mutation classes, stable identity/versioning, restore, recurring and one-shot runtime reuse, ambiguity/invalid restore denial and durable PostgreSQL one-shot scope/restart behavior;
- implementation/test HEAD `3361e24c4a6f8bb103206a15cedf4896c077a9f1` passed exact-head SG 2.1 CI #8310; AW2.18 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.19 implementation/closure evidence:
- the full `npm run check` suite executes the existing AW2.4–AW2.18 regression files covering patch-in-place, no duplicate registration, fresh collection, authority loss, multiple workspaces, explicit partial failure, state-change denial, retry/restart/idempotency, version history and semantic ambiguity;
- `src/automation/workflowExecutionSecurity.js` now bounds current-security snapshots by depth, entries and string length, recursively freezes them, redacts sensitive/private keyed values and prevents raw secret material from reaching runtime handlers or persisted history through that evidence seam;
- the change retains allowed/reason/evidenceRefs and non-sensitive bounded snapshot evidence; it does not bypass or replace Identity, access, Resource Authority, Action Gate, Credential Manager or permission-health checks;
- `tests/automationWorkflowRegressionSecurity.test.js` proves raw credential values exist only inside the authorized Credential Manager callback, public descriptions/audit evidence exclude secret values and secret references, unsafe secret-bearing metadata is rejected, and cross-user scope is denied before secret-store access;
- the same AW2.19 regression file proves snapshot redaction/bounds and confirms the AW2.11 fresh collector cannot receive stored private workflow inputs or prior handoff;
- existing focused evidence remains in `workflowPatchNotDuplicate.test.js`, `runtimeFreshDataCollection.test.js`, `multiWorkspaceActivityAggregator.test.js`, `workflowFailureRetryPolicy.test.js`, `workflowStateChangeEnvelope.test.js`, `workflowRestartContinuity.test.js`, `workflowVersionHistory.test.js` and `workflowNaturalLanguageLifecycle.test.js`;
- implementation/test HEAD `7af9a9285142e25a73fe4ac792382ac86360051e` passed exact-head SG 2.1 CI #8314; AW2.19 is therefore CLOSED / CI-VERIFIED inside this code/test boundary.

AW2.20 production-wiring evidence:
- `src/automation/productionExecutableWorkflowRuntime.js` assembles the existing exact-version workflow continuity, Workflow Executor, current security, fresh workspace collection/aggregation, runtime composition, Delivery Router and durable execution-history seams;
- `src/automation/productionWorkerExecution.js` routes workflow-backed self-notifications into that runtime and fails closed if production workflow execution is unavailable, while preserving the legacy static-message path;
- `src/runtime/renderWebApplication.js` injects existing PostgreSQL workflow/history stores, TWM operations, live workspace authority, bot permission health, canonical Action Gate, Credential Manager, AI Router and Delivery Router into the existing embedded durable worker;
- multi-workspace execution performs force-fresh authority/permission checks independently and never reads denied workspace data; transient authority cache entries are removed on success, denial and permission-health error paths;
- `tests/automationProductionE2E.test.js` covers exact pinned version, fresh current metrics, explicit denied omission, no invalid global unique-actor total, persisted run/gate/source/delivery evidence, fail-closed missing runtime and restart/no-redelivery continuity;
- implementation HEAD `27cd4442f5057c071d881a9d8f79faaf95b54bcb` passed exact-head SG 2.1 CI #8317;
- operator-confirmed deployment reached Telegram, but the first live modification attempt exposed the natural-language workspace-selection gap above; the remediation is implemented and locally regression-green, while exact-head CI, re-deploy and live re-test remain required. AW2.20 remains NOT CLOSED.

Boundary:
- Automation 2.0 generalized workflows are production-wired and deployment-confirmed, but are not yet live-accepted as a complete program;
- `deliver` remains on the existing Delivery Router / execution-security boundary and is not reclassified by AW2.6 as a generic capability mutation, preserving the established self-notification compatibility path;
- AW2.8 resolves existing targets only and does not broaden authority, invent IDs/attributes, perform fuzzy phrase matching or change AW2.7 mutation semantics;
- AW2.9 adds patch-not-duplicate regression proof without rewriting production runtime;
- AW2.10 extends the existing durable version-history record only; it does not implement rollback/restore execution or change scheduler/queue/update semantics;
- AW2.11 establishes the generic runtime fresh-collection semantics used by concrete collectors;
- AW2.12 implements the concrete collector for exactly one canonical authorized workspace and reuses existing TWM store/analytics contracts;
- AW2.13 aggregates that collector across independently re-authorized canonical workspaces, reports denied/unavailable resources explicitly and does not treat workspace-local unique actors as globally additive;
- AW2.14 composes final runtime output from current step evidence, keeps deterministic metrics outside AI control and routes optional narrative through the existing logged/costed AI Router;
- AW2.15 prevents false success, preserves explicit partial completion and routes only explicitly temporary failures into the existing bounded durable retry/DLQ mechanism;
- AW2.16 persists one inspectable run record per occurrence/attempt with ordered step, source, gate, AI/cost, delivery and terminal evidence;
- AW2.17 keeps one occurrence identity across materialization/retry/restart, resolves the pinned durable version and prevents completed delivery replay;
- AW2.18 adds semantic lifecycle/restore through existing production mutation and security seams without phrase-table routing or duplicate runtime infrastructure;
- AW2.19 closes the consolidated CI regression/security matrix and bounds secret/private evidence at the existing execution-security and Credential Manager seams;
- AW2.20 production wiring is CI-verified and deployment-confirmed; the remediated live modification, fresh delivery, authority-loss and restart acceptance are still required before AW2.20 and Automation 2.0 can close.

Canonical docs:
- `../architecture/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS.md`
- `AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_PROGRAM.md`
- `../workflow/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_WORKFLOW.md`

## Memory / project-development programs

### Memory 2.0

M1–M9 — **CLOSED**.

### Project Memory 3.0

PM3.1–PM3.12 — **CLOSED**.

### Project Development Knowledge 4.0

- PDK4.1–PDK4.12 — **CLOSED / CI-VERIFIED** inside their documented evidence boundary.
- PDK4.13 — **LIVE ACCEPTANCE / NOT CLOSED**.

PDK4.13 current live slice:
- real credential-bound GitHub repository reading;
- GET-only current HEAD/tree/commits/changed files/bounded relevant code;
- production `repository-analyze` wiring;
- bounded repository evidence;
- `compose-answer` user-facing composition;
- final full-input preflight preventing the observed `INPUT_TOO_LARGE` failure without truncating system rules or the canonical user request;
- live Telegram repository-derived answer confirmed.

Still required before PDK4.13 closure: complete autonomous-history bootstrap/resume, continuous ingestion, durable single-flight, restart continuity, exactly-once new-commit ingestion, replay=0, protected diagnostics/health and the full production acceptance chain defined by PDK4.13 roadmap/architecture/workflow.

Canonical docs:
- `PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md`
- `../architecture/PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md`
- `../workflow/PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING_WORKFLOW.md`

## Telegram Workspace Manager 1.0

The lifecycle labels still embedded in the original large `TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md` are **not the current status authority** where they say TWM1.12 is next or TWM1.13–1.15 are merely planned. Those labels are superseded by actual implementation and live evidence; the underlying requirements/gates in that program remain valid.

Current status:

- TWM1.1–TWM1.11 — **CLOSED / implementation and CI evidence recorded**.
- TWM1.12 Production E2E & Live Acceptance — **advanced into real live acceptance; not a future-only next step**. Multiple Telegram group/Mini App/config/runtime flows are live-confirmed, while some acceptance cases remain open.
- TWM1.13 Telegram Mini App — **IMPLEMENTED / LIVE-VERIFIED for the exercised management flows; not a merely planned future item**.
- TWM1.14 Content, Polls, Quizzes & Media Management — **IMPLEMENTED IN SUBSTANTIAL PART / LIVE ACCEPTANCE IN PROGRESS / NOT CLOSED**.
- TWM1.15 Community Operations, Engagement & Analytics — **IMPLEMENTATION + LIVE ACCEPTANCE IN PROGRESS / NOT CLOSED**.

Current implementation evidence includes production operations/persistence plus code for content publication, media publication, polls/result updates, interactive tests, participation/community operations and deterministic analytics. Live checkpoint evidence includes real text/media/poll/quiz publication and scheduled publication. This does not prove every TWM1.14/TWM1.15 acceptance criterion.

Known remaining/open acceptance from the current live evidence set includes, as applicable:
- authority-loss-before-execution denial and restoration behavior where not safely live-proven;
- second-account `poll_answer` acceptance;
- second-workspace isolation acceptance;
- authoritative persisted analytics verification;
- remaining persistence/restart acceptance for operational records;
- moderation/community operations with fresh rights checks;
- complete interactive multi-question test UX/participant isolation where not yet live-accepted.

Historical rollback/checkpoint evidence such as `../../docs/checkpoints/SG2.1_2026-08-15_1946.md` must remain unchanged and is intentionally historical.

## Telegram Membership & Subscription 2.1

- TMA2.1.1–TMA2.1.3 — **IMPLEMENTED / CI-VERIFIED** at implementation/test HEAD `4f6bdfffe72dac0888a1843c18b11e7973e5bd0b` by SG 2.1 CI #8406: webhook join requests, durable per-user membership state, fail-closed workspace resolution, free approval and production wiring.
- TMA2.1.4 — **IMPLEMENTED / CI-VERIFIED** at HEAD `01c8c4882ee61a944e19f4455eaff5f825022247`, CI #8432: private admin UI, Action Gate confirmation, durable managed link, reuse/rotation and «Присоединиться» button.
- TMA2.1.5 — **IMPLEMENTED / AWAITING EXACT-HEAD CI + LIVE ACCEPTANCE**: durable baseline/strict policy, safe observed legacy-member activation, explicit high-risk Action Gate sealing, admin/creator/bot exemption and strict removal of unknown direct additions. Telegram cannot enumerate all ordinary members, so the UI warns the owner before strict activation.
- TMA2.1.6–TMA2.1.12 — **PLANNED**: monthly Telegram Stars plan/payment lifecycle, expiry reminders and enforcement, administration, recovery/security and live acceptance.
- Paid access is intentionally disabled until the owner approves price, Stars amount, duration, grace period and refund policy.
- Direct Telegram administrator adds cannot be intercepted; managed entry requires a private group and a join-request invite link.

Canonical doc: `TELEGRAM_MEMBERSHIP_SUBSCRIPTION_2_1_PROGRAM.md`.

## SG Access Control System 1.0

**PLANNED / NOT IMPLEMENTED** unless newer code/CI/live evidence explicitly supersedes that state.

ACS1 is a separate transport-neutral access/entitlement layer. Do not confuse existing Owner Security, Identity, Resource Authority or TWM workspace authority with completion of ACS1.

Canonical doc: `SG_ACCESS_CONTROL_SYSTEM_1_0_PROGRAM.md`.

## Current-status rule for SG answers

When SG is asked “what stage is development at?” or another current-state question:
1. read current branch HEAD and CI where the request requires live repository state;
2. inspect actual production wiring/tests relevant to the claim;
3. use this current-status index and current evidence docs;
4. use large roadmap/program documents for requirements and historical intent;
5. explicitly call out stale/superseded status labels rather than repeating them as current truth.

No keyword/phrase-based shortcut may replace semantic routing, evidence retrieval or authorization.
