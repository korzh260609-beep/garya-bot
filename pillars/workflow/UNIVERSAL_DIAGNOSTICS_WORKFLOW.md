# SG 2.1 — UNIVERSAL DIAGNOSTICS WORKFLOW

## Status

Canonical implementation and verification workflow for the planned Universal Diagnostics D1–D12 program.

This workflow does not mark any D-stage complete by itself.

## Program boundary

Universal Diagnostics is implemented as an independent application around SG 2.1. It is not inserted into the ordinary SG request path.

Every D-stage must preserve:

- SG remains operational if Diagnostics is unavailable;
- SG-side changes are limited to bounded fact instrumentation/read-only diagnostic surfaces;
- Diagnostics is read-only by default;
- no diagnostic path grants identity, roles, permissions, ownership or authority;
- no diagnostic path bypasses Action Gate or Owner Security;
- synthetic tests are isolated from ordinary memory/settings/tasks/profile state;
- secrets/private content are minimized and redacted;
- deterministic evidence analysis is authoritative over AI explanation.

Architecture: `../architecture/UNIVERSAL_DIAGNOSTICS.md`.
Roadmap: `../roadmap/UNIVERSAL_DIAGNOSTICS_PROGRAM.md`.

## Standard stage procedure

Each D-stage follows:

1. confirm current branch HEAD and CI before changes;
2. define scope and explicit non-goals;
3. define/update versioned contracts first;
4. implement skeleton/interfaces;
5. add configuration only where required;
6. implement minimal deterministic logic;
7. add unit/contract tests;
8. add integration tests;
9. verify privacy/redaction/read-only boundaries;
10. verify SG availability independence;
11. update architecture/roadmap/workflow evidence references;
12. run `npm ci`, migrations when applicable, `npm run check`, runtime start and worker verification;
13. capture CI/runtime evidence;
14. mark the D-stage complete only when acceptance criteria are proven by code/tests/runtime evidence.

No stage may be declared complete from documentation alone.

# D1 — Diagnostic Contract & Read-Only Boundary

## Build
- versioned `DiagnosticEvent` contract;
- canonical stage/status/error taxonomy;
- correlation fields (`traceId`, `requestId`, optional span/run/test IDs);
- diagnostic source adapter contract;
- privacy/redaction rules;
- read-only access contract;
- tests proving event schema validation and redaction.

## SG integration rule
Existing Observability is extended where possible. Do not create a second independent logging architecture inside SG.

## Verification
- malformed/unsupported diagnostic events fail visibly;
- raw secrets are rejected/redacted;
- instrumentation has no decision-side effects;
- turning off the diagnostic consumer does not affect SG runtime.

## Completion evidence
- contract tests;
- SG runtime tests with Diagnostics absent;
- redaction fixtures;
- CI green.

# D2 — Collector & Evidence Storage

## Build
- read-only collectors/adapters for approved evidence sources;
- normalized evidence record;
- deduplication/idempotency;
- diagnostics persistence boundary;
- indexes by trace/request/run/revision/component/time;
- retention/cleanup policy;
- collector health/readiness.

## Verification
- duplicate input does not duplicate logical evidence;
- stale/unavailable sources are explicitly represented;
- collector cannot mutate observed SG tables/state through its normal credentials;
- source provenance/freshness survive persistence.

# D3 — Trace Reconstruction

## Build
- deterministic timeline reconstruction;
- parent/child correlation;
- retry/fallback branches;
- execution/delivery separation;
- missing-stage inference;
- trace summary contract.

## Verification
Fixtures must cover:
- normal conversational trace;
- retry trace;
- fallback trace;
- capability timeout;
- delivery failure after successful execution;
- worker/task trace;
- partial/missing evidence.

# D4 — Expected Paths & Invariants

## Build
- versioned Expected Path Registry;
- applicability rules;
- required/conditional/alternative stages;
- ordering constraints;
- invariant registry;
- deterministic expected-vs-actual evaluator.

## Verification
- path definitions cannot call/alter SG business logic;
- version selection is deterministic;
- known valid traces pass;
- known malformed traces identify the correct violated invariant/path rule.

# D5 — First Divergence Engine

## Build
- earliest material divergence algorithm;
- distinction between failed, missing, skipped and allowed-alternative stages;
- downstream-candidate propagation;
- `FirstDivergence` result contract.

## Verification
Each fixture must assert the exact first divergence, not only a generic failure class.

Required fixtures:
- transport never reaches runtime;
- wrong identity/scope evidence;
- Action Gate denial;
- capability timeout;
- AI provider timeout beneath capability;
- response guard not reached because parent failed;
- delivery failure after valid response.

# D6 — Root Cause Analyzer

## Build
- deterministic dependency traversal from first divergence;
- error-code and timeout ownership rules;
- retry/fallback interpretation;
- dependency/version mismatch rules;
- confidence levels;
- evidence requirement for `CONFIRMED`;
- cause/effect graph.

## AI boundary
AI may be connected only after deterministic findings are produced. Its output is explanatory/advisory and cannot upgrade confidence to `CONFIRMED` without deterministic evidence.

## Verification
- historical signature without current evidence cannot become confirmed cause;
- one dependency outage collapses correlated downstream failures under the correct primary cause;
- independent failures remain separate when evidence proves separate branches.

# D7 — Deployment / Runtime / Infrastructure Diagnostics

## Build
Read-only adapters/checks for, when available:
- approved GitHub branch/HEAD;
- GitHub Actions tested commit/result;
- deployed web revision;
- deployed worker revision;
- runtime-reported revision;
- schema/migration version;
- contract compatibility;
- PostgreSQL health;
- AI provider availability;
- transport/provider availability;
- worker/scheduler health.

## Verification
- old deployed revision is diagnosed as deployment mismatch before newer-code blame;
- web/worker revision mismatch is explicit;
- database outage shows affected dependencies separately;
- unavailable evidence source reduces confidence instead of inventing state.

# D8 — Live Diagnostic Runner

## Build
- `diagnostic=true` metadata;
- `diagnostic_run_id`;
- `test_case_id`;
- isolated diagnostic actor/scope;
- safe test catalogue;
- cleanup/disposable fixture rules;
- anti-pollution gates.

## Mandatory anti-pollution tests
A synthetic run must not:
- enter ordinary confirmed long-term memory;
- alter user preferences;
- alter profile/psychological adaptation state;
- create ordinary persistent tasks outside disposable diagnostic fixtures;
- broaden identity/permission/authority;
- be counted as ordinary user traffic where analytics distinguishes diagnostic traffic.

## External transport tests
External delivery tests require an explicitly approved test target. The runner must not discover or choose arbitrary recipients.

# D9 — Replay & Regression Library

## Build
- bounded replay fixture format;
- incident record;
- regression-case contract;
- before/after comparison;
- link to fixed revision where known;
- technical incident knowledge base.

## Safety
Default replay is analysis-only and cannot reproduce protected external side effects.

## Verification
- known historical failure fixture fails under old expected behavior and passes under current fixed behavior where a deterministic fixture exists;
- replay cannot send real external messages or mutate live state by default;
- old incident signatures do not override fresh evidence.

# D10 — Reports / API / UI / Security

## Build
- `DiagnosticReport` contract;
- report generator;
- search/query endpoints;
- evidence drill-down;
- owner-secured full diagnostics;
- bounded non-privileged health response;
- audit of diagnostic access and test execution;
- optional UI consuming the same API/report contracts.

## Required report structure
- status;
- trace/run;
- symptom;
- environment/revision;
- expected path;
- first divergence;
- root cause class/component;
- expected vs actual;
- downstream effects;
- confidence;
- evidence references;
- suggested inspection area;
- unknowns.

## Verification
- no secret leakage;
- no cross-user/resource evidence leakage;
- unauthorized full report access fails closed;
- owner identity uses canonical SG owner-security evidence, never usernames/phrases/secret words.

# D11 — E2E Verification

Build deterministic end-to-end diagnostic scenarios for:

1. healthy conversational flow;
2. transport receive failure;
3. identity resolution mismatch;
4. scope mismatch;
5. memory failure;
6. semantic/action mismatch;
7. Action Gate denial;
8. capability timeout;
9. AI Router retry/fallback;
10. AI provider failure;
11. response-guard failure;
12. delivery failure after execution success;
13. PostgreSQL outage;
14. worker/scheduler outage;
15. deployment revision mismatch;
16. schema/contract mismatch;
17. missing telemetry stage;
18. one primary failure with multiple downstream effects;
19. two proven independent failures;
20. Diagnostics consumer unavailable while SG remains operational;
21. privacy/redaction boundaries;
22. synthetic-run anti-pollution.

Each scenario asserts:
- first divergence;
- root cause class;
- confidence;
- evidence references;
- downstream effects;
- absence of prohibited mutations/leakage.

# D12 — Independent Production Deployment

## Build
- separate Diagnostics entrypoint/process;
- independent service configuration;
- separate Render service or equivalent deployment unit;
- independent health/readiness;
- least-privilege read-only credentials;
- independent release/rollback;
- diagnostics data retention/backup where needed;
- operational runbook.

## Production verification
- SG web remains healthy when Diagnostics service is stopped;
- SG worker remains healthy when Diagnostics service is stopped;
- Diagnostics reports SG runtime unavailable when SG is intentionally stopped;
- Diagnostics failure cannot create SG restart loops;
- credential revocation for Diagnostics does not revoke SG runtime credentials;
- rollback of Diagnostics does not roll back SG.

## Completion rule

The Universal Diagnostics program is complete only when D1–D12 have independent acceptance evidence and the final deployed Diagnostics service can localize representative failures without becoming part of SG's decision or action path.
