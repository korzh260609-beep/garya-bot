# Tasks Module — RISKS

Purpose:
- Document the main risk surface of the Tasks module.
- Prevent hidden execution, duplicate runs, and lifecycle confusion.
- Keep task-engine behavior explicit and reviewable.

Status: CANONICAL
Scope: Tasks module risk model

---

## 0) Why this file matters

Task systems fail in dangerous ways even when the app still “works”.

Common failure pattern:
- one run happens twice
- one retry becomes many retries
- one task exists but nobody knows its real state
- one chat flow secretly executes task logic outside the task model

This file exists to make those risks explicit early.

---

## 1) Primary risks

### R-01: Hidden execution outside task model
Description:
- real task-like work happens outside explicit task boundaries

Consequence:
- no reviewable task lifecycle
- weak observability
- duplicated logic
- fragile future scaling

Signal:
- important work runs, but there is no clear task/run identity

---

### R-02: Duplicate task runs
Description:
- the same task/run executes more than once without controlled idempotency

Consequence:
- duplicate outputs
- repeated alerts/actions
- polluted logs/state
- hard debugging

Signal:
- repeated effects with unclear run identity

---

### R-03: Retry logic becomes uncontrolled
Description:
- retries are scattered, implicit, or effectively unbounded

Consequence:
- retry storms
- repeated failures
- wasted resources
- hard-to-understand execution behavior

Signal:
- many repeated attempts without clear retry policy

---

### R-04: Task lifecycle is ambiguous
Description:
- task state does not clearly show what happened or what should happen next

Consequence:
- operator confusion
- bad recovery paths
- wrong future actions

Signal:
- task exists, but its real state is unclear or misleading

---

### R-05: Task failure visibility is weak
Description:
- failures are swallowed, blurred, or not tied to explicit runs

Consequence:
- false confidence
- delayed debugging
- broken trust in automation

Signal:
- users/operators see missing outcomes but no clear task failure trace

---

### R-06: Docs drift from actual task behavior
Description:
- task lifecycle or run rules evolve, but docs stay stale

Consequence:
- humans/AI build on false assumptions
- execution bugs become easier to create

Signal:
- docs describe one lifecycle, runtime acts differently

---

## 2) Secondary risks

### R-07: Over-modeling trivial flows as tasks
Consequence:
- unnecessary complexity

### R-08: Under-modeling real tasks
Consequence:
- hidden automation behavior

### R-09: Scheduling metadata is mistaken for execution control
Consequence:
- tasks appear planned but are operationally weak

### R-10: Task ownership is unclear
Consequence:
- no one module clearly owns execution discipline

---

## 3) Dangerous assumptions

The following assumptions are dangerous:

- “it is okay to run this directly for now”
- “duplicate runs are probably harmless”
- “retry can be added anywhere”
- “task state is obvious”
- “if it succeeded once, the execution model is fine”
- “manual and scheduled runs do not need the same discipline”

These assumptions must be treated as risk factors.

---

## 4) Regression checks after Tasks changes

After any meaningful Tasks change, verify:

1. important work still flows through explicit task boundaries where intended
2. duplicate-run protections still hold where required
3. retry behavior is bounded and visible
4. lifecycle states remain understandable
5. run failures remain traceable
6. docs still match actual task behavior

---

## 5) Risk handling strategy

Preferred defenses:

- explicit task identity
- explicit run identity
- clear lifecycle states
- bounded retry/idempotency policy
- strong observability
- stale-doc detection

Avoid fake safety:
- hidden execution shortcuts
- scattered retry code
- silent failure swallowing
- ambiguous state transitions

---

## 6) Highest-priority rule

The most dangerous task bug is not always a crash.

The most dangerous bug is:
“the system keeps doing work, but nobody can clearly explain what ran, why it ran, or whether it ran twice.”

That destroys operational trust.