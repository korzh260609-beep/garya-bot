# Logging Module — README

Purpose:
- Define the Logging / Diagnostics module as a stable responsibility domain.
- Fix what belongs to observability, event tracing, and diagnostics.
- Prevent logs and diagnostics from turning into hidden business logic.

Status: CANONICAL
Scope: Logging / Diagnostics logical module

---

## 0) Module purpose

The Logging / Diagnostics module is responsible for:

- recording important system events
- exposing execution and failure visibility
- supporting debugging and operator review
- preserving observability boundaries
- making hidden failures easier to detect

This module exists so SG can be inspected, diagnosed, and trusted operationally.

---

## 1) In scope

Logging / Diagnostics includes responsibilities such as:

- event logging
- error logging
- task/source/behavior diagnostics
- operator-facing diagnostic surfaces
- observability hooks for important system actions
- bounded telemetry and review support

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

Also out of scope:
- using logs as a hidden control plane
- silently mutating system behavior because “diagnostics knows better”

---

## 3) Core idea

Logging / Diagnostics must answer:

- what happened?
- when did it happen?
- what failed?
- why is this behavior visible?
- can the operator inspect it?

It must not answer:
- what should the system do next as hidden policy

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

---

## 5) Hard invariants

The following invariants must hold:

- logs must not silently change business outcomes
- important failures must remain observable
- diagnostic surfaces must stay reviewable
- event recording must remain bounded enough to operate safely
- observability must not become hidden orchestration logic
- missing visibility must be treated as a real system weakness

---

## 6) Relationship to adjacent modules

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

## 7) Examples of what Logging / Diagnostics may do

Allowed examples:

- record task run failures
- record source failures
- record access denials
- expose health/status commands
- provide recent error summaries
- log important behavior events
- support bounded diagnostic review

These are observability responsibilities.

---

## 8) Examples of what Logging / Diagnostics must not do

Forbidden examples:

- decide feature behavior based on log convenience alone
- silently suppress real failures because output looks cleaner
- become the place where hidden retries/business control live
- replace explicit workflow/governance with telemetry guesses
- mutate module meaning through “diagnostic shortcuts”

These create dangerous hidden coupling.

---

## 9) Ownership rule

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

then it belongs elsewhere.

---

## 10) Final rule

Logging / Diagnostics exists so SG can be inspected without distortion.

If logs become hidden control logic,
the system becomes harder to trust and harder to reason about.