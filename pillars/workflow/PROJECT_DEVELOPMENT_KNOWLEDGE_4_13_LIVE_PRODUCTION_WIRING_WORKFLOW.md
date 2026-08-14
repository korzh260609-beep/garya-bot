# SG 2.1 — PDK4.13 LIVE PRODUCTION WIRING WORKFLOW

## Status
**PLANNED / NOT IMPLEMENTED.**

This workflow defines the implementation and acceptance sequence for PDK4.13. It extends the closed PDK4.1–PDK4.12 software baseline into real production operation without changing PM3 authority, trust, provenance or Context Guard rules.

## Mandatory sequence

```text
verify dev/sg2.1-semantic HEAD + latest CI
→ inspect current production entrypoints
→ define bounded PDK4 production config
→ wire GitHub credential through existing credential/security layer
→ implement production PDK4 orchestrator
→ add PostgreSQL single-flight lock
→ wire startup bootstrap/resume
→ wire reconcile-to-current
→ wire periodic ingestion
→ add protected diagnostics
→ add aggregate health/observability
→ tests
→ full repository CI
→ deploy
→ live production acceptance
→ canonical documentation synchronization
```

## Pre-implementation checks
Before code changes:
- verify branch HEAD and latest SG 2.1 CI;
- inspect `renderWebEntrypoint`, `renderWebApplication`, worker entrypoint and production harness;
- inspect PDK4.2/P4.9/P4.12 stores and contracts rather than duplicating them;
- confirm PostgreSQL migrations/state are compatible;
- confirm no secret-bearing field can enter PM3/PDK4 payloads.

## Configuration discipline
Configuration must be explicit, bounded and centralized. At minimum resolve:
- enable/disable flag;
- project key;
- repository allowlist/value;
- development branch;
- poll interval;
- batch size;
- max commits per run.

Invalid configuration fails closed for PDK4 but should not silently disable unrelated SG security.

## Credential discipline
GitHub credentials:
- remain in existing credentials management;
- are requested only for the GitHub connection purpose;
- are never persisted in PM3/PDK4 facts;
- are never logged or returned by diagnostics;
- are never sent to AI Router.

## Startup workflow

```text
SG production start
→ start PostgreSQL/runtime dependencies
→ initialize PDK4 production runtime if enabled
→ acquire project/repository single-flight lock
→ read historical cursor
→ if incomplete: resume bounded historical bootstrap
→ if complete: verify continuous anchor
→ reconcile to current GitHub HEAD
→ release lock
→ start periodic scheduler/poller
```

A failed PDK4 startup reconciliation records degraded state but must not take down ordinary SG transports unless an explicit safety-critical dependency exists.

## Historical bootstrap workflow
Bootstrap uses only existing PDK4 primitives:

```text
immutable branch anchor
→ oldest-first bounded page
→ source verify/normalize
→ significance
→ event extraction
→ clustering
→ PM3 candidate pipeline
→ durable checkpoint
→ repeat
→ reconstruction/reconciliation/snapshot
→ cursor complete
```

Checkpoint advancement occurs only after the corresponding batch is durably processed.

## Continuous ingestion workflow

```text
completed bootstrap
→ persisted last processed SHA
→ bounded GitHub compare
→ unseen commits
→ immutable source verification
→ PDK4 processing
→ PM3
→ reconciliation/snapshot refresh
→ durable ingestion state
```

No new commit means `processed=0` and no Project Memory mutation.

## Concurrency workflow
Before bootstrap/reconcile, acquire one PostgreSQL-backed lock keyed by project/repository. If lock acquisition fails because another process owns it:
- return/record `already-running`;
- do not fetch/process duplicate history;
- do not treat it as a system failure.

Always release the lock on successful/failed completion or rely on PostgreSQL session-scoped release guarantees.

## Polling workflow
Periodic reconciliation:
- cadence is configurable;
- one run is bounded by max commits/API requests/timeouts;
- overlapping poll ticks are skipped by single-flight;
- retry/backoff is bounded;
- provider outage becomes degraded PDK4 health with evidence.

## Protected diagnostics workflow
A protected endpoint such as `/internal/pdk4/diagnostics` must:
- authorize Monarch/internal diagnostics access before reading data;
- call the existing PDK4.12 diagnostics component;
- return bounded JSON only;
- redact/omit secrets and unrestricted raw memory;
- use `no-store` response caching policy;
- fail closed on authorization denial.

## Main health workflow
`/health` may include aggregate PDK4 state only:

```text
projectDevelopmentKnowledge:
  enabled
  healthy
  phase
```

Provider-specific secrets/raw diagnostics stay outside normal health output.

## Observability workflow
Emit structured, bounded events for bootstrap, reconciliation, commit processing, failure and health transitions. Events must preserve project/repository/source identity where safe, but never credential material or unrestricted source content.

## Evidence/lifecycle workflow
Every ingested fact remains subject to PM3 confirmation/trust/lifecycle rules. PDK4 production wiring cannot promote:
- CI → deployment;
- deployment → live verification;
- model interpretation → confirmed truth;
- historical/superseded fact → current state.

## Test gates
Required automated coverage:
1. empty DB starts bootstrap;
2. partial cursor resumes correctly;
3. completed cursor avoids historical rescan;
4. PostgreSQL restart preserves state;
5. new commit ingested once;
6. replay ingests zero;
7. concurrent trigger is single-flight;
8. invalid repo/branch/auth fails closed;
9. GitHub outage/divergence degrades safely;
10. diagnostics are authorized and secret-safe;
11. main runtime remains available during PDK4 degradation;
12. ordinary SG project-history question uses guarded PM3/PDK4 context.

Run dedicated PDK4.13 tests plus `npm run check`, runtime, worker, diagnostics and E2E gates.

## Deployment acceptance workflow
After CI success, deploy the exact verified revision and collect real live evidence:

```text
production start
→ diagnostics: bootstrap complete
→ commits_scanned > 0
→ events_extracted > 0
→ restart Render/runtime
→ cursor unchanged/preserved
→ create or deploy a new real repository commit
→ ingestion detects exactly one new source
→ next reconciliation processes zero
→ ordinary Telegram SG question returns guarded project-history answer
```

Deployment success alone is not sufficient. PDK4.13 requires the live behavior above.

## Failure acceptance
Deliberately/controlled-test where safe:
- GitHub unavailable → PDK4 degraded, SG still serving normal requests;
- duplicate poll → single-flight/no duplicate events;
- unauthorized diagnostics request → denied;
- restart mid-bootstrap → resumes from committed cursor;
- mismatched repository/branch → fail closed.

## Completion rule
PDK4.13 is **CLOSED / CI + live-production verified** only after implementation, automated tests, full CI, successful deployment, live bootstrap/restart/new-commit/replay/query acceptance and final documentation synchronization.
