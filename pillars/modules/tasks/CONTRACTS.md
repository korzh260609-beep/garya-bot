# Tasks Module — CONTRACTS

Purpose:
- Define the public contract expectations of the Tasks module.
- Fix the task lifecycle and execution boundary.
- Reduce guessing during future task-engine work.

Status: CANONICAL
Scope: Tasks logical interfaces

---

## 0) Contract philosophy

Tasks contracts define how explicit units of work are represented and executed.

This file does not require exact current implementation names.
It defines the contract shape that future task work must preserve.

If implementation diverges, that divergence must be made explicit.

---

## 1) Canonical boundary

Task-related behavior must go through an explicit task boundary.

Canonical logical capabilities may include:

- create/update task
- trigger task run
- track task state
- track task run result/failure
- enforce bounded retry/idempotency rules

The exact file/function names may evolve.
The boundary itself must remain explicit.

---

## 2) Contract set

### 2.1 `createTask(...)`
Purpose:
- create an explicit task unit with defined identity and metadata

Expected input:
- task definition/payload
- owner/scope metadata
- schedule or execution mode if applicable

Preconditions:
- task intent is explicit enough to model
- required ownership/scope info exists
- unsupported task types fail explicitly

Postconditions:
- task exists in explicit state or controlled failure occurs
- task can later be reviewed/executed according to policy

Must NOT do:
- silently create ambiguous task records
- hide missing required task metadata

---

### 2.2 `runTask(taskId, ...)`
Purpose:
- trigger one bounded execution run of a task

Expected input:
- explicit task identifier
- optional run context

Preconditions:
- task exists
- execution path is allowed
- duplication/idempotency concerns are handled explicitly where required

Postconditions:
- exactly one bounded run attempt is initiated or controlled failure occurs
- run state is observable enough for review

Must NOT do:
- silently run non-existent or ambiguous tasks
- allow hidden uncontrolled duplicate runs where idempotency matters

---

### 2.3 `updateTaskState(taskId, state, ...)`
Purpose:
- move task lifecycle state explicitly

Expected input:
- task identifier
- explicit next state
- optional reason/metadata

Preconditions:
- task exists
- state transition is valid enough under current policy

Postconditions:
- task state becomes reviewable
- downstream operators can understand current task lifecycle

Must NOT do:
- mutate task lifecycle implicitly
- hide transition reason when it matters operationally

---

### 2.4 `recordTaskRun(taskId, runResult, ...)`
Purpose:
- persist run result/failure/telemetry in bounded form

Expected input:
- task identifier
- run outcome/result metadata

Preconditions:
- associated run exists or is explicitly being recorded
- result shape is bounded enough to store safely

Postconditions:
- run result is reviewable
- failure/success state remains visible

Must NOT do:
- lose failure visibility
- silently drop critical run outcome metadata

---

### 2.5 `retryTask(taskId, ...)`
Purpose:
- perform explicit retry according to task retry policy where applicable

Expected input:
- task identifier
- retry context

Preconditions:
- task/run is retry-eligible by policy
- retry limits/backoff/idempotency are respected

Postconditions:
- retry attempt is explicit and reviewable
- task execution remains bounded

Must NOT do:
- retry indefinitely by accident
- create hidden retry storms
- bypass idempotency/duplicate protections

---

## 3) Caller obligations

Any caller using Tasks must:

- refer to explicit task identity
- respect lifecycle/state model
- treat retries as policy-bound
- keep task execution reviewable

Caller must NOT:
- hide task execution in unrelated modules
- bypass explicit task state transitions
- assume duplicated runs are harmless

---

## 4) Side effects

Task operations may have side effects such as:

- task persistence
- task run creation
- task run logging/telemetry
- scheduling metadata updates
- retry metadata changes

These side effects must remain explicit and predictable.

Hidden side effects are dangerous.

---

## 5) Error behavior

Tasks operations should fail in a controlled way when:

- task definition is invalid
- task is missing
- state transition is invalid
- run is duplicated unsafely
- retry policy blocks the action
- execution dependency is unavailable

Preferred behavior:
- explicit failure
- reviewable state
- bounded retry/duplicate behavior

Forbidden behavior:
- silent execution loss
- hidden duplicate runs
- ambiguous lifecycle mutation

---

## 6) Forbidden patterns

The following patterns are explicitly forbidden:

- hidden task execution in random handlers/modules
- retry logic scattered invisibly across the codebase
- task lifecycle mutated without explicit state handling
- pretending idempotency is optional where duplicate execution matters
- burying run failures so operators cannot trace what happened

---

## 7) Future contract expansion

Future additions may include contracts for:

- richer scheduling
- queue/worker integration
- DLQ integration
- task templates
- recurring task governance
- user-visible task cost estimation

These additions must preserve the same principles:
- explicit
- lifecycle-aware
- observable
- bounded

---

## 8) Final rule

Tasks contracts exist so SG execution can be understood as a system, not as a collection of accidents.

If task execution loses explicit boundaries,
the whole engine becomes fragile.