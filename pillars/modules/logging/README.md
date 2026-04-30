# Logging Module — README

Purpose:
- Define the Logging / Diagnostics module as a stable responsibility domain.
- Fix what belongs to observability, event tracing, and diagnostics.
- Prevent logs and diagnostics from turning into hidden business logic.
- Keep visibility aligned with controlled-action boundaries.

Status: CANONICAL
Scope: Logging / Diagnostics logical module

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/architecture/DATA_FLOW.md`
- `pillars/architecture/PERMISSIONS_MAP.md`

If this file conflicts with `pillars/DECISIONS.md`, `DECISIONS.md` has priority.

---

## 0) Module purpose

The Logging / Diagnostics module is responsible for:

- recording important system events
- exposing execution and failure visibility
- supporting debugging and operator review
- preserving observability boundaries
- making hidden failures easier to detect
- surfacing protected-action blocks, confirmations, cost/risk warnings and permission denials where applicable

This module exists so SG can be inspected, diagnosed, and trusted operationally.

Logging / Diagnostics is a visibility component of SG, not SG itself and not decision authority.

---

## 1) In scope

Logging / Diagnostics includes responsibilities such as:

- event logging
- error logging
- task/source/behavior diagnostics
- operator-facing diagnostic surfaces
- observability hooks for important system actions
- bounded telemetry and review support
- audit-adjacent visibility for controlled actions where appropriate

Typical related code areas may include:
- interaction logs
- task/source/error event logs
- diagnostics helpers
- health/status surfaces
- event rendering helpers

---

## 2) Out of scope

The Logging / Diagnostics module must NOT own:

- transport parsing
- business feature logic
- permission policy
- memory semantics
- source-fetching logic itself
- task scheduling logic itself
- AI routing policy
- user-facing feature meaning
- SG philosophy, identity, governance, or accepted decisions

Also out of scope:
- using logs as a hidden control plane
- silently mutating system behavior because “diagnostics knows better”
- treating diagnostics access as governance authority

---

## 3) Core idea

Logging / Diagnostics must answer:

- what happened?
- when did it happen?
- what failed?
- why is this behavior visible?
- can the operator inspect it?
- was a protected action blocked, confirmed, denied or warned?

It must not answer:
- what should the system do next as hidden policy
- who has governance authority

Observability must remain visible, not controlling.

---

## 4) Core responsibilities

The Logging / Diagnostics module is responsible for:

1. recording meaningful events
2. surfacing errors/failures
3. supporting bounded diagnostics
4. preserving operator reviewability
5. making silent failure less likely
6. keeping observability separate from business execution
7. supporting traceability of controlled-action gates where applicable

---

## 5) Hard invariants

The following invariants must hold:

- logs must not silently change business outcomes
- important failures must remain observable
- diagnostic surfaces must stay reviewable
- event recording must remain bounded enough to operate safely
- observability must not become hidden orchestration logic
- missing visibility must be treated as a real system weakness
- diagnostics must not bypass permissions/private scope
- logs must not expose private data casually

---

## 6) Controlled-action visibility rule

Logging / Diagnostics may record or expose visibility for:

```text
permission_denied
protected_action_blocked
confirmation_required
controller_gate_used
source_failure
cost_warning
state-changing action attempt
external-action attempt
```

Rules:
- visibility does not grant authority;
- logs should support review, not secretly control flow;
- sensitive logs require scope/permission handling;
- private payloads should be minimized/redacted where appropriate.

---

## 7) Relationship to adjacent modules

Logging / Diagnostics is closely related to:

- Bot
- Tasks
- Sources
- Users / Access
- Transport
- Repo
- Memory
- AI Routing

But Logging / Diagnostics does not own those modules.

It owns event visibility and diagnostic surfaces about them.

---

## 8) Examples of what Logging / Diagnostics may do

Allowed examples:

- record task run failures
- record source failures
- record access denials
- expose health/status commands
- provide recent error summaries
- log important behavior events
- support bounded diagnostic review
- show that a confirmation was required or a protected action was blocked

These are observability responsibilities.

---

## 9) Examples of what Logging / Diagnostics must not do

Forbidden examples:

- decide feature behavior based on log convenience alone
- silently suppress real failures because output looks cleaner
- become the place where hidden retries/business control live
- replace explicit workflow/governance with telemetry guesses
- mutate module meaning through “diagnostic shortcuts”
- treat diagnostics output as permission to perform protected action

These create dangerous hidden coupling.

---

## 10) Ownership rule

If the question is:
- how an event/failure is recorded
- how the operator can inspect system state
- how to expose diagnostics safely
- how to preserve traceability

it belongs here.

If the question is:
- what the feature should do
- who is allowed to do it
- how data should be fetched/stored
- how AI should reason
- whether a protected action should proceed

then it belongs elsewhere.

---

## 11) Final rule

Logging / Diagnostics exists so SG can be inspected without distortion.

If logs become hidden control logic,
the system becomes harder to trust and harder to reason about.

If diagnostics become authority,
the controlled-action model is broken.