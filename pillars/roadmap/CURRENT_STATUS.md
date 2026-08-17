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

**ACCEPTED ARCHITECTURE / IMPLEMENTATION IN PROGRESS — AW2.1–AW2.12 CLOSED / CI-VERIFIED; AW2.13 NEXT; NOT DEPLOYED / NOT LIVE-VERIFIED AS AUTOMATION 2.0.**

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
- AW2.12 concrete single-workspace `workspace-activity` collector that reuses existing TWM persisted activity/analytics semantics, requires current execution security and returns deterministic publication/poll/test/interaction/activity-event evidence with explicit data-window/source metadata.

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

Boundary:
- Automation 2.0 generalized workflows are not yet production-wired/live-accepted as a complete program;
- `deliver` remains on the existing Delivery Router / execution-security boundary and is not reclassified by AW2.6 as a generic capability mutation, preserving the established self-notification compatibility path;
- AW2.8 resolves existing targets only and does not broaden authority, invent IDs/attributes, perform fuzzy phrase matching or change AW2.7 mutation semantics;
- AW2.9 adds patch-not-duplicate regression proof without rewriting production runtime;
- AW2.10 extends the existing durable version-history record only; it does not implement rollback/restore execution or change scheduler/queue/update semantics;
- AW2.11 establishes the generic runtime fresh-collection semantics used by concrete collectors;
- AW2.12 implements the concrete collector for exactly one canonical authorized workspace and reuses existing TWM store/analytics contracts; it does not implement multi-workspace aggregation;
- AW2.13 is next; multi-workspace aggregation, dynamic composition, idempotency and live acceptance remain later stages.

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