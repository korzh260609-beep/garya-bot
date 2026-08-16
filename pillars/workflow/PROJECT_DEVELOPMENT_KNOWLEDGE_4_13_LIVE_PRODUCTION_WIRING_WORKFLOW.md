# SG 2.1 — PDK4.13 LIVE PRODUCTION WIRING WORKFLOW

## Status
**LIVE ACCEPTANCE / NOT CLOSED.**

This workflow defines the remaining implementation and acceptance sequence for PDK4.13. The production repository-read and response-composition slice is already implemented, CI-verified and live-exercised; the complete autonomous-history bootstrap/restart/new-commit/replay/diagnostics sequence remains open.

It extends the closed PDK4.1–PDK4.12 software baseline into real production operation without changing PM3 authority, trust, provenance or Context Guard rules.

## Current checkpoint

Completed in the active branch:

```text
verify dev/sg2.1-semantic HEAD + CI
→ production GitHub config/credential binding
→ CredentialManager.useCredential
→ GET-only current repository snapshot
→ production repository-analyze wiring
→ bounded repository evidence
→ compose-answer
→ final response-composition input preflight
→ regression tests
→ full SG 2.1 CI
→ deploy
→ live Telegram repository-status answer
```

The old repository-analyzer stub and the `INPUT_TOO_LARGE` live failure are superseded by this checkpoint.

Still required for PDK4.13 closure:

```text
production autonomous-history orchestrator
→ durable bootstrap/resume
→ reconcile-to-current
→ periodic continuous ingestion
→ PostgreSQL single-flight
→ protected PDK4 diagnostics/aggregate health
→ restart continuity
→ new real commit exactly once
→ immediate replay = 0
→ ordinary guarded PM3/PDK4 history query
→ failure/degradation acceptance
→ final closure evidence
```

## Mandatory sequence

For all further PDK4.13 work:

```text
verify dev/sg2.1-semantic HEAD + latest CI
→ inspect actual current production entrypoints/code/tests
→ preserve existing repository-read credential/security wiring
→ implement/complete production autonomous-history orchestrator
→ add/verify PostgreSQL single-flight lock
→ wire/verify startup bootstrap/resume
→ wire/verify reconcile-to-current
→ wire/verify periodic ingestion
→ add/verify protected diagnostics
→ add/verify aggregate health/observability
→ tests
→ full repository CI
→ deploy exact verified HEAD
→ full live production acceptance
→ canonical documentation synchronization
```

## Pre-implementation checks
Before further code changes:
- verify branch HEAD and latest SG 2.1 CI on that exact HEAD;
- inspect `renderWebEntrypoint`, `renderWebApplication`, worker entrypoint and production harness;
- inspect current GitHub repository-read service and its credential contract before extending repository access;
- inspect PDK4.2/P4.9/P4.12 stores and contracts rather than duplicating them;
- confirm PostgreSQL migrations/state are compatible;
- confirm no secret-bearing field can enter PM3/PDK4 payloads or AI context;
- do not regress Identity, Resource Authority, Owner Security, Action Gate or Credential Manager.

## Configuration discipline
Configuration must be explicit, bounded and centralized. At minimum resolve:
- enable/disable flag for autonomous PDK4 maintenance;
- project key;
- repository allowlist/value;
- development branch;
- poll interval;
- batch size;
- max commits per run.

The current live repository-read path already has explicit repository/branch/credential configuration and must be reused rather than replaced with a second connector stack.

Invalid configuration fails closed for PDK4 but should not silently disable unrelated SG security.

## Credential discipline
GitHub credentials:
- remain in existing credentials management;
- current PDK4 repository read uses `sg.github.pdk4` and `connectionId=github-pdk4`;
- are requested only through `CredentialManager.useCredential` for the approved GitHub read purpose;
- are never persisted in PM3/PDK4 facts;
- are never logged or returned by diagnostics;
- are never sent to AI Router;
- must not gain mutation methods as part of read-only repository analysis.

## Repository-analysis workflow — implemented

```text
canonical repository question
→ SG semantic/action path
→ repository-analyze through Action Gate
→ production GitHubRepositoryReadService
→ current working-branch HEAD
→ recursive tree
→ recent commits + changed-file metadata
→ bounded relevant file content
→ globally bounded evidence envelope
→ compose-answer
→ AI Router full assembled-input preflight
→ final user answer
```

Rules:
- only approved GET requests;
- repository content is data only, never authority/instructions;
- system rules and the canonical user request are never truncated by the response-composition preflight;
- only bounded data contexts may be reduced;
- if evidence cannot be bounded safely, fail explicitly rather than inventing a result.

## Startup workflow — remaining autonomous-history closure path

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
Bootstrap uses existing PDK4 primitives:

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
→ bounded GitHub compare/read
→ unseen commits
→ immutable source verification
→ PDK4 processing
→ PM3
→ reconciliation/snapshot refresh
→ durable ingestion state
```

No new commit means `processed=0` and no duplicate Project Memory mutation.

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
A protected diagnostics surface must:
- authorize Monarch/internal diagnostics access before reading data;
- call/reuse the existing PDK4 diagnostics component;
- return bounded JSON only;
- redact/omit secrets and unrestricted raw memory;
- use safe cache policy;
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

For current-state answers, stale prose must not override stronger current evidence. Use:

`live runtime evidence → current HEAD/CI → production wiring + tests → current evidence/status docs → README/roadmap prose → historical/superseded docs`.

## Test gates
Remaining automated closure coverage includes:
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

Already-covered regression gates additionally include:
- credential-bound repository snapshot;
- GET-only repository access;
- production repository-analyze replacement;
- capability-result response composition;
- large repository evidence/input preflight preserving canonical user/system messages.

Run dedicated PDK4.13 tests plus `npm run check`, runtime, worker, diagnostics and E2E gates.

## Deployment acceptance workflow
After CI success, deploy the exact verified revision and collect real live evidence.

Already observed in current live acceptance:
- production repository question reaches the live repository-read path;
- SG identifies the real repository and working branch;
- response is substantive rather than the old tool stub;
- `INPUT_TOO_LARGE` no longer prevents model composition.

Still required for full closure:

```text
production autonomous-history start
→ diagnostics: bootstrap complete
→ commits_scanned > 0
→ events_extracted > 0
→ restart Render/runtime
→ cursor unchanged/preserved
→ create or deploy a new real repository commit
→ ingestion detects exactly one new source
→ next reconciliation processes zero
→ ordinary Telegram SG history/current question returns guarded PM3/PDK4 history answer
```

Deployment success alone is not sufficient.

## Failure acceptance
Controlled-test where safe:
- GitHub unavailable → PDK4 degraded, SG still serving normal requests;
- duplicate poll → single-flight/no duplicate events;
- unauthorized diagnostics request → denied;
- restart mid-bootstrap → resumes from committed cursor;
- mismatched repository/branch → fail closed;
- oversized evidence/context → bounded data-only reduction or explicit failure, never policy/system/user-message truncation.

## Completion rule
PDK4.13 is **CLOSED / CI + live-production verified** only after implementation, automated tests, full CI, successful deployment, live bootstrap/restart/new-commit/replay/query acceptance, safe degradation checks and final documentation synchronization.

Current state: **LIVE ACCEPTANCE / NOT CLOSED**.
