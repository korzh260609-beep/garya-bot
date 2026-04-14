# Tasks Module — README

Purpose:
- Define the Tasks module as a stable responsibility domain.
- Fix what belongs to task definition, execution flow, and task lifecycle.
- Prevent task behavior from scattering across unrelated modules.

Status: CANONICAL
Scope: Tasks logical module

---

## 0) Module purpose

The Tasks module is responsible for:

- representing tasks as explicit system units
- managing task lifecycle/state
- scheduling or triggering task execution paths
- preserving task-related execution discipline
- exposing task-oriented control surfaces

This module exists to keep SG task execution structured, observable, and separable from ad hoc chat behavior.

---

## 1) In scope

Tasks includes responsibilities such as:

- task creation flow
- task state/lifecycle
- scheduling metadata
- task execution entry
- task run coordination
- task-related observability hooks
- bounded retry/execution policy where applicable

Typical related code areas may include:
- task services
- task scheduler/runner logic
- task metadata/state helpers
- task-run tracking helpers
- task commands and task execution interfaces

---

## 2) Out of scope

The Tasks module must NOT own:

- transport parsing
- permission policy itself
- source/provider fetching logic
- memory semantics
- AI routing policy
- deep domain-specific business logic of every task payload
- generic bot routing behavior

Also out of scope:
- becoming a hidden replacement for workflow/governance
- silently executing things that were never modeled as tasks

---

## 3) Core idea

Tasks must make SG execution answerable in system terms:

- what task exists?
- what state is it in?
- when should it run?
- why did it run or fail?
- what is one run vs another run?

This must stay explicit.

---

## 4) Core responsibilities

The Tasks module is responsible for:

1. representing task identity and state
2. starting task execution in a controlled way
3. tracking task runs/results/failures where applicable
4. preserving task boundaries across scheduling/manual execution
5. making task behavior reviewable and observable

---

## 5) Hard invariants

The following invariants must hold:

- task execution must remain explicit
- task state/lifecycle must be reviewable
- task runs must not be silently duplicated where idempotency matters
- task behavior must not be hidden inside unrelated chat flows
- scheduling metadata must not replace actual execution discipline
- task failures must remain visible

---

## 6) Relationship to adjacent modules

Tasks is closely related to:

- Bot
- Sources
- Users / Access
- Logging / Diagnostics
- AI Routing
- domain-specific report/monitor features

But Tasks does not own those modules.

It owns task structure and execution boundaries.

---

## 7) Examples of what Tasks may do

Allowed examples:

- create a task record
- trigger a run
- store run state/result metadata
- prevent duplicate execution where required
- expose `/tasks`-style status surfaces
- coordinate retries according to explicit policy

These are task responsibilities.

---

## 8) Examples of what Tasks must not do

Forbidden examples:

- treat any ad hoc request as a hidden task without explicit modeling
- hide execution state
- bury retry logic invisibly across random modules
- own provider-specific source logic
- own permission policy
- replace observability with guesswork

These damage execution integrity.

---

## 9) Ownership rule

If the question is:
- what a task is
- how a task starts/runs/retries/fails
- how task state is tracked
- how scheduled/manual task execution stays disciplined

it belongs here.

If the question is:
- whether the user may create/run it
- what source data the task consumes
- how memory is selected
- how AI explains the result

then it belongs elsewhere or must be shared with adjacent modules.

---

## 10) Final rule

Tasks exists to make execution explicit and traceable.

If execution starts happening “somewhere somehow”,
the system becomes harder to debug, trust, and scale.