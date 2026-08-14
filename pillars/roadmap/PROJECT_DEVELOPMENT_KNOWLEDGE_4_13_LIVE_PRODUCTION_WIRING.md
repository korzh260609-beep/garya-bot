# SG 2.1 — PDK4.13 LIVE PRODUCTION WIRING ROADMAP

## Status
**PLANNED / NOT IMPLEMENTED.**

PDK4.13 is the next stage after the CI-verified PDK4.1–PDK4.12 baseline. Its purpose is to connect the existing Project Development Knowledge engine to the real SG 2.1 production runtime so project history is automatically bootstrapped, resumed, incrementally updated and diagnosable in live operation.

## Scope
PDK4.13 must implement:
1. production PDK4 runtime/orchestrator;
2. explicit production configuration and GitHub credential wiring;
3. automatic historical bootstrap/resume from PostgreSQL;
4. startup reconcile-to-current;
5. periodic continuous GitHub ingestion;
6. PostgreSQL-backed single-flight/concurrency guard;
7. protected production PDK4 diagnostics;
8. aggregate `/health` integration without making GitHub availability a hard dependency for normal SG runtime;
9. bounded observability for bootstrap/reconciliation/degradation/recovery;
10. production acceptance proving restart continuity, new-commit ingestion, zero-duplicate replay and ordinary SG history answers.

## Canonical dependency

```text
PM3.1–PM3.12 CLOSED
→ PDK4.1–PDK4.12 CLOSED / CI-verified
→ PDK4.13 Live Production Wiring & Autonomous Project History
```

PDK4.13 reuses existing PDK4.2 scanner, PDK4.3 verification, PDK4.4–PDK4.8 interpretation/reconstruction, PDK4.9 incremental ingestion, PDK4.10 snapshot, PDK4.11 normal answer integration and PDK4.12 diagnostics/acceptance primitives. It must not duplicate them.

## Implementation slices

### A. Production composition
Create/wire a production development-knowledge runtime that:
- resolves authorized project/repository/branch;
- starts with PostgreSQL-backed stores;
- detects `not-started|in-progress|complete` bootstrap state;
- resumes bootstrap when needed;
- reconciles to current HEAD after completion;
- supports clean start/stop.

### B. Credentials/config
Introduce bounded environment/config fields for enabling PDK4, project/repository/branch, polling interval, batch size and maximum commits per run. GitHub token material must pass through the existing credential/security boundary and never enter memory/AI/diagnostic output.

### C. Autonomous historical bootstrap
On first live activation:
- resolve branch to immutable anchor;
- scan oldest-first;
- persist cursor/checkpoint after bounded batches;
- recover after process restart;
- reach `historical_bootstrap_status=complete`.

### D. Continuous ingestion
After bootstrap completion:
- reconcile persisted last commit to current HEAD;
- process unseen commits only;
- update durable state;
- periodic poll with configurable cadence;
- immediate replay after no GitHub change must process zero commits.

### E. Concurrency protection
Add one active reconciliation per project/repository using PostgreSQL advisory lock or equivalent durable single-flight. Concurrent web/worker triggers must not duplicate processing.

### F. Diagnostics/health
Expose a protected diagnostics endpoint backed by PDK4.12 diagnostics and an aggregate non-secret health signal in normal `/health`. PDK4 GitHub outages should degrade PDK4 but keep ordinary SG runtime available.

### G. Observability
Persist/emit bounded events for bootstrap started/progress/completed, reconciliation started/discovered/processed/completed, ingestion failure, health degraded and recovered.

### H. Evidence semantics
Keep `implemented`, `tested`, `ci-verified`, `deployed`, `live-verified`, `rejected` and `superseded` distinct. CI cannot auto-promote deployment/live state. Historical superseded facts remain queryable but not current.

### I. Ordinary answers
Verify normal Telegram/transport questions about origin, evolution, rationale, incidents, current state and working commits use PDK4.11 → PM3 Hybrid Retrieval → Context Guard without a separate memory command.

## Required tests
Expected dedicated coverage:
- `projectDevelopmentKnowledge4LiveWiring`;
- `projectDevelopmentKnowledge4ProductionBootstrap`;
- `projectDevelopmentKnowledge4AutonomousIngestion`.

Coverage must include:
- empty DB/bootstrap;
- partial bootstrap resume;
- PostgreSQL restart continuity;
- incremental new commit;
- replay idempotency;
- concurrency lock;
- authorization/repository denial;
- GitHub outage/divergence;
- diagnostics authority and secret safety;
- main runtime remains healthy/degraded appropriately;
- ordinary SG project-history query after restart.

## Live acceptance
PDK4.13 requires real production evidence, not CI simulation only:

```text
first live start
→ bootstrap complete
→ commits_scanned > 0
→ events_extracted > 0
→ restart
→ same durable cursor
→ new real commit
→ processed exactly once
→ replay = 0
→ diagnostics healthy
→ ordinary SG history/current query succeeds
```

## Definition of Done
PDK4.13 becomes **CLOSED / CI + live-production verified** only when:
- production GitHub connection is operational;
- automatic bootstrap/resume works;
- continuous ingestion runs autonomously;
- concurrency is protected;
- diagnostics are protected and secret-safe;
- failures degrade safely without taking SG offline;
- ordinary SG answers use the live-maintained history;
- CI succeeds;
- production deployment succeeds;
- live acceptance succeeds;
- all canonical architecture/roadmap/workflow indexes are synchronized.

Until then, PDK4.1–PDK4.12 remain closed, while PDK4.13 remains planned/in progress.
