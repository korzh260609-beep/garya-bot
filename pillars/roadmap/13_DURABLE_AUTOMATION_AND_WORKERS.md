# Block 13 — Durable Automation and Workers

## Status

Implemented on `dev/sg2.1-semantic`. Completion requires a green CI for the current HEAD.

## Goal

Convert the Block 9 reference in-memory automation engine into durable PostgreSQL-backed scheduled and queued execution without changing Semantic Kernel, Identity, Action Gate or Capability contracts.

## Architecture

- Block 9 `automationEngine.js` remains the deterministic reference engine.
- Block 13 adds `postgresTaskQueue.js` as the durable persistence boundary.
- `durableWorker.js` is a separate worker runtime.
- `workerEntrypoint.js` is the worker process entrypoint.
- PostgreSQL migration `002_block13_durable_workers.sql` extends tasks and adds DLQ storage.
- Protected tasks pass Action Gate immediately before every execution attempt.
- Transports do not assign roles, grants or scopes.

## Automation 2.0 substrate relationship

Block 13 remains the durable scheduler/queue/worker substrate for the accepted Automation 2.0 executable-workflow extension. Automation 2.0 must extend this substrate rather than introduce another scheduler or worker stack.

AW2.1 is implemented above these durable primitives: it adds the canonical versioned workflow contract, fail-closed schema/version guards and a backward-compatible adapter for existing `self-notification` tasks without replacing the Block 13 scheduler/queue/worker path. Later Automation 2.0 stages add canonical step contracts, semantic same-automation patching, multi-step execution, fresh execution-time collection and richer execution history. Existing claim/lease/retry/DLQ/idempotency guarantees remain mandatory and must also protect workflow occurrences.

Current Automation 2.0 lifecycle state: **IMPLEMENTATION IN PROGRESS — AW2.1 IMPLEMENTED / CI-VERIFIED; AW2.2 NEXT**. Generalized workflow execution is not yet production-implemented.

Canonical Automation 2.0 documents:
- `../architecture/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS.md`
- `AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_PROGRAM.md`
- `../workflow/AUTOMATION_2_0_EXECUTABLE_WORKFLOWS_WORKFLOW.md`

## Durable states

- `scheduled`
- `waiting_approval`
- `queued`
- `running`
- `completed`
- `cancelled`
- `dead_letter`

## Claim and lease rules

- Claim is atomic and uses `FOR UPDATE SKIP LOCKED`.
- A claimed task receives `lease_owner`, `lease_expires_at` and `heartbeat_at`.
- Heartbeats extend only an owned, non-expired lease.
- Completion and failure require the same lease owner.
- Expired leases are recovered to `queued` when attempts remain.
- Exhausted expired work is moved to DLQ.

## Retry and DLQ

- Retry uses bounded exponential backoff.
- Attempts are persisted.
- Exhausted work is stored in `dead_letter_tasks`.
- DLQ evidence is size-bounded and contains task kind, attempt count and normalized error evidence.
- Secrets remain subject to the existing observability redaction boundary.

## Approval, cancellation and idempotency

- Approval state is persisted in `tasks.approval_state`.
- Cancelled tasks cannot be claimed.
- `idempotency_key` has a unique partial index.
- Duplicate submissions with the same idempotency key return the existing task.
- Executors receive the persisted idempotency key for protected external execution.

## Worker lifecycle

- `npm run start:worker` starts the separate worker entrypoint.
- Worker health exposes phase, accepting state, active task, cycle count, completed count, failed count and last error.
- Graceful shutdown stops polling, waits for active work and closes PostgreSQL.
- CI uses verification mode to execute one durable task through the full worker lifecycle.

## Verification

`tests/durableWorkers.test.js` verifies:

- scheduling and due release;
- persisted approval;
- cancellation cannot be claimed;
- idempotent submission;
- concurrent atomic claims;
- Action Gate before protected execution;
- bounded retry and exponential backoff;
- completion cannot be claimed again;
- lease recovery;
- DLQ creation and evidence;
- denied protected work never reaches executor.

## Acceptance criteria mapping

- No duplicate normal claim: atomic claim plus terminal completed state.
- Scheduled durability: schedule state and `available_at` are PostgreSQL-backed.
- Action Gate: checked directly before each protected attempt.
- Failure visibility: worker observability plus persisted `last_error` and DLQ.
- Cancellation: terminal cancelled state excluded from claim query.
- DLQ diagnosis: bounded evidence retained in `dead_letter_tasks`.
