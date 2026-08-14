# Block 16.5 — Temporal Context

## Status

Completed.

## Goal

Provide SG 2.1 with one canonical, deterministic and user-aware Temporal Context for current UTC time, user-local time, IANA timezones, relative calendar expressions, one-shot and complex recurring task scheduling, and temporal memory recall without making AI or transports the source of time.

## Canonical architecture

`Injected UTC Clock → Global Identity Timezone → Temporal Context Service → Deterministic Temporal Resolution → Recurrence Engine → Durable Schedule Materializer → Existing Durable Task Queue → Worker → Action Gate / Executor`

The implementation does not introduce a second decision or task-execution system. Recurrence only determines when an occurrence exists. Every occurrence becomes an ordinary durable SG task and then uses the existing queue, retry, lease, DLQ, approval and Action Gate boundaries.

## Implemented components

- `src/temporal/temporalService.js`
  - injectable clock;
  - IANA timezone validation;
  - UTC/local context;
  - timezone offset and day-of-week;
  - deterministic local-time to UTC conversion;
  - explicit DST gap/overlap handling;
  - relative dates and calendar periods;
  - RU/UA/EN temporal expressions;
  - normalized temporal result contract.
- `src/temporal/temporalContextService.js`
  - canonical production wrapper;
  - conversational implicit-one expressions such as `через час` and `через неделю`;
  - calendar-safe one-month shifting with last-day clamping.
- `src/temporal/recurrenceEngine.js`
  - deterministic recurring-rule parser and occurrence generator;
  - `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` frequencies;
  - `INTERVAL`, `BYDAY`, ordinal `BYDAY`, `BYMONTHDAY`, `BYMONTH`, `BYHOUR`, `BYMINUTE`, `COUNT`, `UNTIL`;
  - multiple weekdays and multiple local clock values;
  - absolute occurrence sequence numbers;
  - local wall-clock recurrence across DST;
  - ambiguous/nonexistent DST occurrence detection without guessing.
- `src/automation/postgresRecurringScheduler.js`
  - durable recurring schedule registration;
  - first existing task becomes occurrence #1;
  - future occurrences are materialized into the existing durable task queue;
  - `FOR UPDATE SKIP LOCKED` prevents concurrent schedule materialization;
  - one unique task and idempotency key per occurrence;
  - pause, resume and cancel controls;
  - bounded missed-run handling.
- `src/temporal/postgresTimezoneStore.js`
  - persistent timezone settings bound to `global_user_id`.
- `src/temporal/temporalMeaningInterpreter.js`
  - Temporal Context is attached before normal meaning interpretation;
  - deterministic current-time questions;
  - temporal recall routing.
- `src/temporal/temporalCapabilities.js`
  - `time-read`;
  - `timezone-set`;
  - `memory-time-read`.
- `src/temporal/temporalTaskStore.js`
  - relative local schedule normalization to durable UTC;
  - recurring task registration through the same `task-create` path;
  - preserves original expression, timezone and local time;
  - refuses ambiguous broad periods rather than inventing an instant.
- `src/temporal/temporalMemoryProvider.js`
  - scoped memory filtering by the same normalized UTC range used by Temporal Context.
- `src/persistence/migrations/165_temporal_context.sql`
  - persistent timezone, source, provenance and update timestamp on users.
- `src/persistence/migrations/166_recurring_schedules.sql`
  - durable recurrence progression, misfire policy and lifecycle fields;
  - `schedule_occurrences` history and uniqueness constraints.
- `src/runtime/localProductionHarness.js`
  - canonical Temporal Context and recurrence engine wired into PostgreSQL production-like runtime.
- `src/automation/workerEntrypoint.js`
  - recurring materialization runs before the existing queue `releaseDue()` path;
  - existing durable worker remains the task executor.
- `src/runtime/renderWebApplication.js`
  - temporal capabilities available through Telegram production identity/scope;
  - optional explicit `SG_MONARCH_TIMEZONE` bootstrap with provenance.
- `src/ai/productionMeaningInterpreter.js`
  - AI receives authoritative Temporal Context and normalized temporal resolution;
  - AI is instructed not to recalculate or guess deterministic time values.

## Timezone policy

- Canonical timezone identifiers are IANA names such as `Europe/Kyiv`.
- Fixed offsets such as `UTC+3` are not used as the user's canonical timezone.
- Timezone is attached to global identity, not Telegram identity.
- Render/server local timezone is never silently treated as user timezone.
- Unknown user timezone fails visibly when local-time resolution is required.
- Timezone source and provenance are persisted.

## Relative-time support

Deterministic support includes:

- today / yesterday / day before yesterday;
- tomorrow / day after tomorrow;
- explicit N minutes/hours/days/weeks/months in the future or past;
- implicit one-unit phrases such as `через час`, `через неделю`, `месяц назад`;
- this / next / previous week;
- this / next / previous month;
- named weekdays;
- explicit dates;
- local clock expressions;
- broad dayparts represented as ranges rather than fabricated exact timestamps;
- month-end and year-end calendar transitions;
- leap-year dates.

Equivalent RU/UA/EN expressions are handled by the same Temporal Context boundary rather than transport command routing.

## Complex recurring schedules

Recurring schedules preserve local wall-clock intent. A schedule such as `09:00 America/New_York` remains 09:00 locally when DST changes; its UTC execution instant changes as required.

Supported recurrence rule subset:

- `FREQ=DAILY`;
- `FREQ=WEEKLY`;
- `FREQ=MONTHLY`;
- `FREQ=YEARLY`;
- `INTERVAL`;
- `BYDAY=MO,WE,...`;
- ordinal monthly/yearly weekdays such as `1MO` and `-1FR`;
- positive and negative `BYMONTHDAY`;
- `BYMONTH`;
- `BYHOUR`;
- `BYMINUTE`;
- `COUNT`;
- UTC `UNTIL`.

This is a deliberately bounded SG recurrence contract, not a claim of full RFC 5545 coverage. Unsupported iCalendar features such as `BYSETPOS`, `BYSECOND`, `WKST`, `EXDATE`, `RDATE`, and sub-daily `FREQ` values are rejected/not implemented rather than silently approximated.

Each occurrence has:

- stable schedule ID;
- monotonically meaningful sequence number;
- local datetime;
- originating IANA timezone;
- normalized UTC execution instant;
- unique durable task ID;
- unique recurrence idempotency key.

## Misfire and restart policy

Three explicit policies are supported when SG was unavailable while occurrences became due:

- `skip` — missed occurrences are consumed without replay;
- `fire_once` — multiple missed occurrences collapse into one latest materialized occurrence;
- `catch_up` — missed occurrences are materialized in order, bounded by `max_catchup`.

`max_catchup` is limited to 1–100 so a long outage cannot create an unbounded execution storm. Progression is persisted, so process/worker restarts do not reset `COUNT` or occurrence numbering.

## Durable execution and exactly-once materialization

The recurring scheduler does not directly execute work.

1. `task-create` resolves the first local time through Temporal Context.
2. The first ordinary durable task is stored as occurrence #1.
3. The recurrence rule and progression are stored in `schedules`.
4. Worker polling asks the recurring scheduler to materialize due occurrences.
5. Due schedules are locked with `FOR UPDATE SKIP LOCKED`.
6. Every occurrence gets a deterministic task ID and idempotency key.
7. Database uniqueness constraints prevent duplicate occurrence history/task materialization.
8. The ordinary durable worker then handles claim, lease, heartbeat, retry and DLQ.

This provides exactly-once **materialization**. External side-effect exactly-once semantics still depend on the existing Action Gate/idempotency contract of the executed capability, as required by SG architecture.

## Approval and Action Gate safety

Recurring schedules do not weaken protected-action controls:

- approval state from the template is preserved for future occurrence tasks;
- an occurrence requiring approval enters `waiting_approval` rather than the execution queue;
- protected occurrence tasks retain `protected_action`;
- worker execution still invokes Action Gate immediately before protected execution;
- recurrence logic cannot assign roles, grants or broaden scope.

## Normalized temporal contract

Resolved temporal expressions preserve:

- original user expression;
- reference instant;
- IANA timezone;
- local start/date-time;
- optional local end-exclusive range;
- UTC start instant;
- optional UTC end-exclusive range;
- precision/granularity;
- ambiguity state and reason;
- deterministic source and confidence metadata.

## DST behavior

- Nonexistent local wall times during the spring-forward gap are explicitly marked ambiguous/nonexistent and are not silently shifted.
- Duplicate local wall times during the fall-back overlap are explicitly marked ambiguous and are not silently selected.
- The same intended local recurring wall-clock time produces the correct different UTC offsets across seasonal DST changes.
- If an exact recurring occurrence lands on an ambiguous/nonexistent DST local time, the schedule is bounded/fails visibly rather than guessing an instant.

## Task integration

When a task contains a relative/local temporal expression:

1. the user's timezone is loaded by global identity;
2. Temporal Context resolves the expression;
3. broad or ambiguous periods are rejected for exact scheduling;
4. the exact UTC execution instant is stored;
5. the originating timezone, local time and user expression remain preserved for audit/reconstruction;
6. if a recurrence rule is present, it is registered against the same first normalized occurrence.

PostgreSQL is required for durable recurring scheduling. In-memory runtime does not pretend to provide restart-safe recurrence and fails visibly if recurrence is requested without the durable scheduler.

## Memory and recall integration

Temporal recall uses the same normalized range as task scheduling. Requests such as `что мы обсуждали вчера?` are routed to `memory-time-read`, which remains bounded by user/project/group/thread scope before applying the UTC temporal range.

No cross-user, cross-project, group or thread scope is broadened by Temporal Context.

## Safety boundaries

- Temporal Context does not assign identity, roles or grants.
- Transport adapters do not own temporal business logic.
- AI is not the source of current time, timezone conversion, recurrence arithmetic or deterministic calendar arithmetic.
- `timezone-set` remains a state-changing capability and does not bypass Action Gate.
- Temporal/recurring task creation does not bypass Action Gate or existing task safety controls.
- Unknown/ambiguous temporal meaning is surfaced rather than guessed.
- No universal hard-coded user timezone exists.
- A recurrence definition cannot execute work by itself.

## Automated evidence

`tests/temporalContext.test.js` covers deterministic time, timezone, relative expressions, month/year/leap transitions, DST boundaries, task normalization, recall and local runtime behavior.

`tests/recurringScheduler.test.js` additionally covers:

- complex recurrence-rule parsing;
- weekly multiple-day recurrence;
- monthly ordinal weekday recurrence (`-1FR`);
- local wall-clock preservation across DST offset changes;
- `COUNT` termination and absolute sequence continuity;
- ambiguous DST occurrence rejection;
- PostgreSQL bounded catch-up;
- occurrence idempotency and duplicate prevention;
- durable completion after the recurrence limit is reached.

Existing PostgreSQL compatibility tests verify migrations `165_temporal_context.sql` and `166_recurring_schedules.sql` on the SG 2.0-compatible schema.

## CI evidence

Final recurring-engine functional implementation HEAD:

`89824bd48bef3fc5a65395ebdaa39f39d01c0c54`

GitHub Actions:

- workflow: `SG 2.1 CI`;
- run number: `6356`;
- run id: `31260031705`;
- conclusion: success.

Successful required steps:

- `npm ci`;
- `npm run migrate`;
- `npm run check`;
- `npm start`;
- `npm run start:worker`.

The migration run contains six migrations including Temporal Context and Recurring Schedules.

## Acceptance result

Block 16.5 and its recurring-scheduler extension meet the current SG 2.1 runtime boundary:

- current UTC and user-local time are deterministic;
- relative calendar expressions are resolved against user-local time;
- timezone is global-identity scoped and persistent;
- DST ambiguity is explicit;
- one-shot and supported complex recurring schedules preserve intended local wall-clock semantics;
- recurrence progression survives restart;
- missed-run behavior is explicit and bounded;
- occurrence materialization is idempotent;
- protected recurring tasks preserve approval and Action Gate controls;
- memory/recall temporal ranges use the same Temporal service;
- transport and AI do not implement competing temporal arithmetic;
- automated CI, migrations, runtime and worker checks pass.
