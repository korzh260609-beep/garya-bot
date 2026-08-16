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

**ACCEPTED ARCHITECTURE / IMPLEMENTATION IN PROGRESS — AW2.1–AW2.2 IMPLEMENTED / CI-VERIFIED; AW2.3 NEXT; NOT DEPLOYED / NOT LIVE-VERIFIED.**

AW2.1 provides the canonical versioned workflow contract, fail-closed schema/version guards and a backward-compatible adapter from existing `self-notification` tasks. AW2.2 adds the six canonical step types (`collect`, `retrieve`, `analyze`, `compose`, `invoke-capability`, `deliver`), fail-closed step-type validation, immutable canonical step normalization and workflow-level step validation. The implementation remains additive above the existing durable automation substrate: it does not replace or bypass the current scheduler, queue, worker, Identity/Scope, Access, Resource Authority, Action Gate or Credential Manager paths.

AW2.1 implementation evidence:
- `src/automation/workflowContract.js` defines workflow schema v1 with `automationId`, workflow `version`, trigger, steps, inputs, delivery, execution policy, scope, actor/timestamps and provenance;
- unsupported workflow schema versions and unsupported trigger types fail closed;
- existing in-memory and persisted snake_case `self-notification` task shapes can be adapted without mutating the legacy task;
- regression tests cover canonical fields, immutability, schema/version guards, one-shot/recurring legacy adaptation and rejection of non-`self-notification` tasks;
- implementation commit `0b45ede3516f60ca38b4b748263f914d71d33405` passed exact-head SG 2.1 CI #8104.

AW2.2 implementation evidence:
- `src/automation/workflowContract.js` exports exactly six canonical workflow step types and rejects missing/unsupported step types fail-closed;
- `createWorkflowStep()` normalizes and recursively freezes JSON-compatible step metadata without executing the step;
- `createWorkflowDefinition()` now validates every ordered workflow step against the canonical step-type contract;
- `src/automation/index.js` exports the AW2.2 step contract helpers;
- `tests/automationWorkflowContract.test.js` covers the exact canonical type set, immutability, rejection of missing/unsupported types and coexistence/order of all six step classes without execution;
- implementation commit `251e7b73253eb8f05b4a07563c7087568c234bea` passed exact-head SG 2.1 CI #8116.

The broader Automation 2.0 runtime is **not yet implemented**. AW2.1–AW2.2 define workflow and step contracts only; they do not yet execute generalized workflow steps, semantically mutate automations, collect fresh runtime data, persist version/execution history or perform the AW2.20 live scenario. The next implementation stage is **AW2.3 — Workflow Executor**.

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
