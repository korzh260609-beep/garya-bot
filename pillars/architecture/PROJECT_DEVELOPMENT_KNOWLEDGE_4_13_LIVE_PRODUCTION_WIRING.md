# SG 2.1 — PDK4.13 LIVE PRODUCTION WIRING & AUTONOMOUS PROJECT HISTORY

## Status
**PLANNED / NOT IMPLEMENTED.**

PDK4.13 extends the closed PDK4.1–PDK4.12 baseline by wiring the already implemented Project Development Knowledge engine into the real SG 2.1 production runtime. It does not replace Project Memory 3.0, create a second memory database, or weaken existing authority/evidence boundaries.

## Goal
Make SG autonomously maintain its own evidence-backed development history in production:

```text
production start
→ inspect durable PDK4 state
→ historical bootstrap if incomplete
→ durable cursor = complete
→ reconcile repository to current HEAD
→ continuous incremental ingestion
→ Project Memory 3.0
→ diagnostics / observability
→ ordinary SG development answers
```

The resulting system must know what changed, when, why, what was superseded, which failures occurred, how they were fixed, and what evidence verifies each development state.

## Production runtime
Add a production orchestration component such as:

`src/projectDevelopmentKnowledge/productionDevelopmentKnowledgeRuntime.js`

Responsibilities:
- start only when explicitly enabled;
- resolve one authorized `projectKey`, repository and development branch;
- construct the production GitHub history source;
- read PostgreSQL historical cursor and continuous-ingestion state;
- run/resume historical bootstrap when incomplete;
- never start continuous ingestion before bootstrap completion;
- reconcile from the durable anchor to current GitHub HEAD;
- schedule bounded periodic reconciliation;
- expose secret-safe health/diagnostics;
- stop cleanly with the SG runtime.

## Configuration
Production configuration must be explicit and bounded, for example:

```text
SG_PDK4_ENABLED=true
SG_PDK4_PROJECT_KEY=sg2.1
SG_PDK4_REPOSITORY=korzh260609-beep/garya-bot
SG_PDK4_BRANCH=dev/sg2.1-semantic
SG_PDK4_POLL_INTERVAL_MS=300000
SG_PDK4_BATCH_SIZE=50
SG_PDK4_MAX_COMMITS_PER_RUN=200
```

GitHub credentials must be stored through the existing SG credential/security boundary. Tokens, `DATABASE_URL`, private credentials and raw secrets must never enter Project Memory, AI context, ordinary diagnostics or logs.

## Historical bootstrap
First production activation must process repository history oldest-first through the existing PDK4 pipeline:

```text
GitHub history
→ source verification/normalization
→ significance classification
→ event extraction
→ clustering/milestones
→ historical reconstruction
→ temporal/causal reconciliation
→ PM3 candidate/confirmation pipeline
```

Bootstrap must be resumable and idempotent. A process restart resumes from the last committed PostgreSQL cursor; it must not restart from genesis unless the durable state is intentionally reset by authorized maintenance.

## Continuous ingestion
After bootstrap status is `complete`, production reconciliation uses the persisted last source/commit anchor and processes only unseen commits.

```text
last processed SHA
→ GitHub compare
→ unseen commits
→ PDK4 pipeline
→ PM3
→ durable ingestion checkpoint
```

Immediate replay with no repository change must process zero commits and create no duplicate project events.

## Trigger model
PDK4.13 requires both:
1. startup reconcile-to-current after SG/PDK4 production initialization;
2. bounded periodic polling using a configurable interval.

A GitHub webhook may later act as a wake-up trigger, but webhook payloads remain trigger metadata only; immutable repository evidence must still be re-read and verified.

## Concurrency guard
Only one reconciliation may run per project/repository at a time across web/worker processes. Use a PostgreSQL-backed lock/advisory-lock boundary or an equivalent durable single-flight mechanism.

A second concurrent attempt must return a safe `already-running`/no-op outcome rather than double-processing sources.

## Restart recovery
PostgreSQL is the durable state authority for PDK4 scanner/ingestion bookkeeping. Render/process restart must preserve:
- completed bootstrap state;
- last historical source id;
- last processed commit SHA;
- processed-source identities;
- ingestion timestamps/state.

## Diagnostics
Add a protected production diagnostics surface, for example:

`/internal/pdk4/diagnostics`

It must be available only through verified Monarch/internal diagnostics authority and expose bounded fields from `createDevelopmentKnowledgeDiagnostics`, including:
- development history health;
- bootstrap status/cursor;
- commits scanned;
- extracted/confirmed/rejected/superseded events;
- unresolved conflicts;
- timeline/component/snapshot health;
- continuous ingestion health;
- last successful ingestion;
- reconciliation/source gaps;
- last processed commit SHA where available.

No secret, credential, raw database URL or unrestricted raw-memory payload may be returned.

## Main health integration
Normal `/health` may expose only aggregate state such as:

```text
projectDevelopmentKnowledge.enabled
projectDevelopmentKnowledge.healthy
projectDevelopmentKnowledge.phase
```

Temporary GitHub/PDK4 degradation must not automatically make Telegram/Discord/runtime unavailable. SG may remain READY while PDK4 reports DEGRADED, unless a separate mandatory readiness policy explicitly requires otherwise.

## Evidence semantics
PDK4.13 must preserve strict evidence-state separation:

```text
planned
implemented
tested
ci-verified
deployed
live-verified
rejected
superseded
```

A successful CI run may prove `ci-verified`; it must not prove deployment or live runtime. Deployment/live state requires separately approved trusted evidence.

## Error/fix history
Production ingestion must preserve causal chains when supported by evidence:

```text
problem
→ investigation
→ root cause
→ decision
→ fix
→ test
→ CI
→ deployment
→ runtime verification
```

Historical incident similarity remains advisory-only for diagnosis of a current live problem; Universal Diagnostics/live evidence remains authoritative for current runtime root cause.

## Supersession
Old decisions and implementations remain auditable. When newer evidence supersedes them, PDK4/PM3 must retain both historical and current records with explicit lifecycle/currentness qualification.

## Working commit knowledge
SG answers about a "working commit" must state the requested/proven evidence level, for example:
- latest implemented commit;
- latest test-verified commit;
- latest CI-verified commit;
- latest deployed commit;
- latest live-verified commit.

Unknown stronger evidence must remain unknown.

## Ordinary query integration
No special memory command is required. Existing PDK4.11 normal SG query integration remains the only answer path:

```text
ordinary question
→ PDK4 query classification
→ PM3 Hybrid Retrieval
→ PM3 Context Guard
→ bounded development context
→ AI Router composition / deterministic fallback
```

## Observability
Emit bounded structured events such as:
- `pdk4_bootstrap_started`;
- `pdk4_bootstrap_batch_completed`;
- `pdk4_bootstrap_completed`;
- `pdk4_reconciliation_started`;
- `pdk4_commit_discovered`;
- `pdk4_commit_processed`;
- `pdk4_commit_rejected`;
- `pdk4_reconciliation_completed`;
- `pdk4_ingestion_failed`;
- `pdk4_health_degraded`;
- `pdk4_health_recovered`.

Observability payloads remain secret-safe and non-authoritative.

## Resource limits
Production ingestion must have bounded pagination/batches, request timeouts, retry/backoff, maximum commits per run, one active reconciliation per project/repository, and safe shutdown behavior. Unbounded repository scanning is forbidden.

## Fail-closed conditions
Ingestion must stop/degrade rather than invent progress when:
- project/repository authorization fails;
- repository is outside the allowlist;
- branch/source scope mismatches durable state;
- cursor/state is invalid or incompatible;
- GitHub history diverges from the accepted anchor;
- source identity cannot be established;
- GitHub/provider response is invalid;
- concurrent reconciliation owns the lock.

## Production acceptance boundary
PDK4.13 is not CLOSED until real production evidence proves:
1. bootstrap from durable production PostgreSQL reaches `complete` with `commits_scanned > 0` and extracted events;
2. restart preserves cursor/ingestion state and does not rescan completed history;
3. a new real commit is detected and processed once;
4. immediate replay processes zero new commits;
5. protected diagnostics reports healthy bootstrap/continuous ingestion;
6. ordinary SG questions about project genesis/evolution/current state are answered from guarded PM3/PDK4 knowledge;
7. GitHub outage/degradation does not take down the main SG transport/runtime;
8. no secret leakage or authority bypass is observed.

## Required implementation/test scope
Expected implementation includes production orchestration, config/credential wiring, startup/worker integration, single-flight locking, protected diagnostics and observability.

Expected tests include:
- empty-state bootstrap;
- resume after partial bootstrap;
- PostgreSQL restart;
- incremental commit ingestion;
- replay idempotency;
- concurrency lock;
- GitHub outage/divergence;
- authorization denial;
- diagnostics authorization/secret safety;
- ordinary runtime query integration.

## Definition of Done
**PDK4.13 CLOSED** only after code, tests, CI, production deployment and real live acceptance all succeed and architecture/roadmap/workflow documentation is synchronized.
