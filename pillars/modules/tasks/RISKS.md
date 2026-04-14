# Tasks Module — RISKS

Purpose:
- Document the main risk surface of the Tasks module.
- Prevent hidden execution, duplicate runs, lifecycle confusion, and boundary drift.
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

Important current note:
- Tasks documentation describes the target boundary correctly
- but current runtime still contains boundary debt that must be named explicitly

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

### R-06: Direct AI calls inside task execution layer
Description:
- Tasks directly import or call AI entrypoints instead of going through a clearer AI-routing boundary

Consequence:
- task engine begins to own AI invocation policy
- AI routing discipline weakens
- future cost/routing/governance logic becomes harder to centralize
- Tasks and AI Routing boundaries blur

Signal:
- direct `callAI(...)` usage inside task-engine files

Current reality note:
- this is already present in current repository state
- therefore this risk is active technical debt, not just a future concern

---

### R-07: Docs drift from actual task behavior
Description:
- task lifecycle or run rules evolve, but docs stay stale

Consequence:
- humans/AI build on false assumptions
- execution bugs become easier to create

Signal:
- docs say Tasks should not own AI routing policy, but runtime still contains direct AI invocation inside task execution

---

## 2) Secondary risks

### R-08: Over-modeling trivial flows as tasks
Consequence:
- unnecessary complexity

### R-09: Under-modeling real tasks
Consequence:
- hidden automation behavior

### R-10: Scheduling metadata is mistaken for execution control
Consequence:
- tasks appear planned but are operationally weak

### R-11: Task ownership is unclear
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
- “direct `callAI` inside Tasks is acceptable because it is convenient”

These assumptions must be treated as risk factors.

---

## 4) Active technical debt explicitly acknowledged

The following debt is explicitly acknowledged in current runtime:

1. Tasks still contain direct AI invocation in task execution code
2. task boundary and AI-routing boundary are not yet fully separated
3. parts of the task layer remain closer to orchestration glue than to a clean task-engine abstraction

Important rule:
- this debt is recognized
- it is not canonical target architecture
- it must not be used as a precedent for new code

---

## 5) Regression checks after Tasks changes

After any meaningful Tasks change, verify:

1. important work still flows through explicit task boundaries where intended
2. duplicate-run protections still hold where required
3. retry behavior is bounded and visible
4. lifecycle states remain understandable
5. run failures remain traceable
6. direct AI invocation in Tasks did not spread further
7. docs still match actual task behavior

---

## 6) Risk handling strategy

Preferred defenses:

- explicit task identity
- explicit run identity
- clear lifecycle states
- bounded retry/idempotency policy
- strong observability
- stale-doc detection
- gradual removal of direct AI invocation from task-engine ownership

Avoid fake safety:
- hidden execution shortcuts
- scattered retry code
- silent failure swallowing
- ambiguous state transitions
- treating current direct AI use in Tasks as acceptable steady-state design

---

## 7) Highest-priority rule

The most dangerous task bug is not always a crash.

The most dangerous bug is:
“the system keeps doing work, but nobody can clearly explain what ran, why it ran, whether it ran twice, and who really owns the AI call.”

That destroys operational trust and architectural clarity.