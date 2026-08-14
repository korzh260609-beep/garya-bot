# Block 16.5 — Complex Recurring Scheduler Extension

## Status

Completed.

## Purpose

Extend the canonical Temporal Context with durable complex recurring tasks without introducing a second SG task engine or bypassing existing identity, scope, Action Gate, queue, worker, retry or DLQ boundaries.

## Architecture

`task-create → Temporal Context → first normalized occurrence → recurrence rule → PostgreSQL schedule progression → recurring materializer → existing durable tasks queue → existing worker → Action Gate / executor`

The recurrence engine determines occurrence times only. It never executes user work directly.

## Supported recurrence contract

- `FREQ=DAILY`
- `FREQ=WEEKLY`
- `FREQ=MONTHLY`
- `FREQ=YEARLY`
- `INTERVAL`
- `BYDAY`, including multiple weekdays
- ordinal `BYDAY`, including `1MO` and `-1FR`
- positive/negative `BYMONTHDAY`
- `BYMONTH`
- `BYHOUR`
- `BYMINUTE`
- `COUNT`
- UTC `UNTIL`

This is a bounded SG recurrence contract. It does not claim full RFC 5545 coverage. Unsupported constructs such as `BYSETPOS`, `BYSECOND`, `WKST`, `EXDATE`, `RDATE` and sub-daily recurrence frequencies are not silently approximated.

## DST semantics

Recurrence is defined in local wall-clock time plus an IANA timezone. Each occurrence is converted independently through the canonical Temporal Context.

Therefore a task configured for 09:00 local remains 09:00 local across DST changes while its UTC instant changes as required. Nonexistent or duplicated local DST times are surfaced as errors/ambiguity instead of being guessed.

## Durable progression

Migration `166_recurring_schedules.sql` adds durable recurrence state to `schedules` and creates `schedule_occurrences`.

Persisted state includes:

- recurrence rule;
- IANA timezone;
- local DTSTART;
- active/paused/completed/cancelled/error status;
- missed-run policy;
- bounded catch-up limit;
- generated sequence count;
- last occurrence instant;
- next occurrence instant;
- occurrence history.

## Occurrence model

The initial scheduled task becomes occurrence #1. Every later occurrence is materialized as a new normal SG durable task.

Each later occurrence has:

- deterministic schedule/sequence identity;
- unique task ID `schedule:<scheduleId>:<sequence>`;
- unique idempotency key `recurrence:<scheduleId>:<sequence>`;
- original recurrence/timezone/local datetime metadata;
- the same user/project/group/thread scope as the template task.

Database uniqueness plus `FOR UPDATE SKIP LOCKED` prevents duplicate concurrent materialization.

## Missed-run policy

Supported policies:

- `skip` — missed executions are advanced without replay;
- `fire_once` — missed runs are collapsed into bounded latest execution progression;
- `catch_up` — due occurrences are replayed in order.

Catch-up is bounded by `max_catchup` from 1 to 100 to prevent an unbounded execution burst after downtime.

## Worker integration

The production worker now performs:

1. recurring schedule materialization;
2. existing one-shot schedule release;
3. existing atomic task claim;
4. existing lease/heartbeat/retry/DLQ lifecycle.

The DurableWorker implementation itself remains the execution engine.

## Approval and protected actions

Recurring tasks preserve existing safety controls:

- protected-action state is copied from the template;
- approval requirements are preserved;
- future occurrence tasks that still require approval enter `waiting_approval`;
- Action Gate remains mandatory immediately before protected worker execution;
- recurrence cannot assign identity, roles, grants or capabilities.

## Scoped lifecycle controls

The recurring scheduler provides scoped:

- list;
- status;
- pause;
- resume;
- cancel.

These are exposed through the existing Capability System as:

- `schedule-list`;
- `schedule-status`;
- `schedule-pause`;
- `schedule-resume`;
- `schedule-cancel`.

Read operations remain read-only. Pause/resume/cancel are state-changing capabilities and require Action Gate confirmation. Schedule lookup and mutations are constrained by user/project/group/thread scope.

Guest bootstrap does not automatically receive recurring state-changing capabilities. They require explicit grants; the configured monarch receives the complete capability set.

## Automated evidence

`tests/recurringScheduler.test.js` verifies:

- complex rule parsing;
- weekly multiple weekdays;
- monthly ordinal weekdays;
- local wall-clock recurrence across DST;
- COUNT termination;
- stable absolute sequence numbering;
- explicit DST ambiguity;
- PostgreSQL bounded catch-up;
- occurrence idempotency;
- no duplicate materialization;
- persisted recurrence completion.

`tests/recurringScheduleControls.test.js` verifies:

- schedule ownership by scope;
- cross-user schedule invisibility;
- scoped list/status;
- scoped pause/resume/cancel;
- cross-user mutation denial.

Existing PostgreSQL compatibility tests verify all six migrations, including `166_recurring_schedules.sql`.

## CI evidence

Final functional HEAD:

`e16576b6e53b8d400306d657e0de7fd935a1a3e8`

GitHub Actions:

- workflow: `SG 2.1 CI`;
- run number: `6362`;
- run id: `31260206860`;
- conclusion: success.

Successful steps:

- `npm ci`;
- `npm run migrate`;
- `npm run check`;
- `npm start`;
- `npm run start:worker`.

## Acceptance result

The SG 2.1 recurring scheduler is operational for the supported complex recurrence contract:

- local-time recurrence is timezone/DST aware;
- progression is durable across restart;
- repeated occurrences use the existing SG task engine;
- missed-run behavior is explicit and bounded;
- duplicate materialization is prevented;
- protected actions retain approval and Action Gate controls;
- series lifecycle is scope-bound and capability-controlled;
- full CI/runtime/worker validation passes.
