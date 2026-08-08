# Block 16.5 — Temporal Context

## Status

Completed.

## Goal

Provide SG 2.1 with one canonical, deterministic and user-aware Temporal Context for current UTC time, user-local time, IANA timezones, relative calendar expressions, task scheduling and temporal memory recall without making AI or transports the source of time.

## Canonical architecture

`Injected UTC Clock → Global Identity Timezone → Temporal Context Service → Deterministic Temporal Resolution → Normalized Local/UTC Contract → Meaning / Tasks / Memory / Capabilities`

The implementation does not introduce a second decision system. Action Gate remains the authorization boundary for state-changing actions, and AI Router remains the only production AI path.

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
  - preserves original expression, timezone and local time;
  - refuses ambiguous broad periods rather than inventing an instant.
- `src/temporal/temporalMemoryProvider.js`
  - scoped memory filtering by the same normalized UTC range used by Temporal Context.
- `src/persistence/migrations/165_temporal_context.sql`
  - persistent timezone, source, provenance and update timestamp on users.
- `src/runtime/localProductionHarness.js`
  - canonical Temporal Context wired into both memory and PostgreSQL production-like runtime modes.
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
- Duplicate local wall times during the fall-back overlap are explicitly marked ambiguous and preserve both candidate boundaries.
- The same local wall-clock time produces the correct different UTC offsets across seasonal DST changes.

The current automation engine is one-shot/durable-task based rather than a general RRULE recurrence engine. Temporal Context provides the deterministic local-wall-clock-to-UTC conversion that any future recurring scheduler must call for each occurrence; no separate recurrence arithmetic was introduced here.

## Task integration

When a task contains a relative/local temporal expression:

1. the user's timezone is loaded by global identity;
2. Temporal Context resolves the expression;
3. broad or ambiguous periods are rejected for exact scheduling;
4. the exact UTC execution instant is stored;
5. the originating timezone, local time and user expression remain preserved for audit/reconstruction.

This behavior is identical for in-memory and PostgreSQL production task stores.

## Memory and recall integration

Temporal recall uses the same normalized range as task scheduling. Requests such as `что мы обсуждали вчера?` are routed to `memory-time-read`, which remains bounded by user/project/group/thread scope before applying the UTC temporal range.

No cross-user, cross-project, group or thread scope is broadened by Temporal Context.

## Safety boundaries

- Temporal Context does not assign identity, roles or grants.
- Transport adapters do not own temporal business logic.
- AI is not the source of current time, timezone conversion or deterministic calendar arithmetic.
- `timezone-set` remains a state-changing capability and does not bypass Action Gate.
- Temporal task creation does not bypass Action Gate or existing task safety controls.
- Unknown/ambiguous temporal meaning is surfaced rather than guessed.
- No universal hard-coded user timezone exists.

## Automated evidence

`tests/temporalContext.test.js` covers:

- deterministic UTC/local time;
- multiple timezones for one UTC instant;
- local calendar-day boundaries;
- RU/UA relative-day forms;
- explicit and implicit relative quantities;
- `через неделю` and `через час`;
- month-end clamping;
- exact local-to-UTC scheduling;
- broad-period ambiguity;
- year boundary and leap-year handling;
- DST gap and overlap;
- wall-clock behavior across DST;
- unknown timezone failure;
- global-identity timezone ownership;
- temporal task normalization;
- rejection of ambiguous schedules;
- temporal memory filtering;
- Cyrillic time/recall interpretation;
- end-to-end local runtime current-time answer without AI clock knowledge.

Existing PostgreSQL and Render deployment tests were also updated to verify the additional migration and temporal capability scope.

## CI evidence

Final functional implementation HEAD before documentation closure:

`c61e551f6d6ccdf7e199a56155126fd86af1f413`

GitHub Actions:

- workflow: `SG 2.1 CI`;
- run number: `6343`;
- run id: `31259448552`;
- conclusion: success.

Successful required steps:

- `npm ci`;
- `npm run migrate`;
- `npm run check`;
- `npm start`;
- `npm run start:worker`.

The migration run includes `165_temporal_context.sql` and existing SG 2.0 compatibility tests remain green.

## Acceptance result

Block 16.5 acceptance criteria are met for the current SG 2.1 runtime boundary:

- current UTC and user-local time are deterministic;
- relative calendar expressions are resolved against user-local time;
- timezone is global-identity scoped and persistent;
- DST ambiguity is explicit;
- relative task scheduling is normalized to UTC;
- temporal memory recall uses the same service;
- transport and AI do not implement competing temporal arithmetic;
- automated CI, migrations, runtime and worker checks pass.
