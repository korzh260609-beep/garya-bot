# SG 2.1 — PDK4.13 LIVE PRODUCTION WIRING & AUTONOMOUS PROJECT HISTORY

## Status
**LIVE ACCEPTANCE / NOT CLOSED.**

PDK4.13 extends the closed PDK4.1–PDK4.12 baseline by wiring Project Development Knowledge into the real SG 2.1 production runtime. The direct production repository-read/analysis path is now implemented and live-verified; the complete autonomous project-history lifecycle defined below remains the closure boundary.

It does not replace Project Memory 3.0, create a second memory database, or weaken existing Identity, Resource Authority, Action Gate, Credential Manager, trust, provenance or Context Guard boundaries.

## Current production implementation

The active branch now includes a real read-only GitHub repository evidence path:

```text
canonical user request
→ authorized repository-analyze capability
→ GitHubRepositoryReadService
→ CredentialManager.useCredential(sg.github.pdk4, github-pdk4)
→ GET current working-branch HEAD
→ recursive tree + recent commits + changed files + bounded relevant file contents
→ bounded repository evidence
→ compose-answer
→ final response-composition full-input preflight
→ user-facing answer
```

Properties already implemented/verified:
- branch/repository are production configuration, not model guesses;
- GitHub token material remains inside Credential Manager usage;
- repository reader has no mutation API and uses GET-only requests;
- returned evidence is globally bounded and preserves repository, branch, HEAD, recent change metadata, relevant content and source provenance;
- capability output is treated as factual data-only context and cannot grant authority or execute embedded repository instructions;
- final AI input is checked after all response contexts are assembled; only bounded data contexts may be reduced, while system rules and the canonical user request are preserved;
- non-response-composition AI requests retain normal fail-closed input policy;
- live Telegram acceptance has produced a substantive repository-derived answer without the former tool stub or `INPUT_TOO_LARGE` failure.

This implementation proves live repository reading and answer composition. It does not by itself prove full historical bootstrap/resume, autonomous polling/ingestion, durable single-flight or the complete restart/new-commit/replay acceptance chain.

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
The autonomous-history runtime must:
- start only when explicitly enabled;
- resolve one authorized `projectKey`, repository and development branch;
- use the production GitHub evidence source through the existing credential boundary;
- read PostgreSQL historical cursor and continuous-ingestion state;
- run/resume historical bootstrap when incomplete;
- never start continuous ingestion before bootstrap completion;
- reconcile from the durable anchor to current GitHub HEAD;
- schedule bounded periodic reconciliation;
- expose secret-safe health/diagnostics;
- stop cleanly with the SG runtime.

The direct repository-read service is already production-composed; this section describes the remaining autonomous-history orchestration required for closure.

## Configuration
Production configuration must remain explicit and bounded, including project/repository/branch and autonomous-ingestion controls such as poll interval, batch size and maximum commits per run.

The repository-read slice already uses the PDK4 GitHub credential `sg.github.pdk4` with `connectionId=github-pdk4` through `CredentialManager.useCredential`.

Tokens, `DATABASE_URL`, private credentials and raw secrets must never enter Project Memory, AI context, ordinary diagnostics or logs.

## Historical bootstrap
First production activation of autonomous history must process repository history oldest-first through the existing PDK4 pipeline:

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
→ GitHub compare/read
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
Protected production diagnostics must expose bounded PDK4.12-derived fields such as:
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
Normal `/health` may expose only aggregate PDK4 state such as:

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

For current repository-state answers, evidence priority is:

`live runtime evidence → current HEAD/CI → production wiring + tests → current evidence/status docs → README/roadmap prose → historical/superseded docs`.

A stale README/roadmap statement must be qualified instead of overriding newer code/CI/live evidence.

## Working commit knowledge
SG answers about a "working commit" must state the requested/proven evidence level, for example:
- latest implemented commit;
- latest test-verified commit;
- latest CI-verified commit;
- latest deployed commit;
- latest live-verified commit.

Unknown stronger evidence must remain unknown.

## Ordinary query integration
No special memory command is required. Existing PDK4.11 normal SG query integration remains the autonomous-history answer path:

```text
ordinary question
→ PDK4 query classification
→ PM3 Hybrid Retrieval
→ PM3 Context Guard
→ bounded development context
→ AI Router composition / deterministic fallback
```

The live repository-analysis capability is also an authorized current-source evidence path for repository-specific requests. It must not be confused with proof that the entire durable PDK4 autonomous-history store is fully synchronized.

## Observability
Emit bounded structured events for bootstrap, reconciliation, commit processing, failure and health transitions. Observability payloads remain secret-safe and non-authoritative.

## Resource limits
Production ingestion must have bounded pagination/batches, request timeouts, retry/backoff, maximum commits per run, one active reconciliation per project/repository, and safe shutdown behavior. Unbounded repository scanning is forbidden.

The live repository-read slice additionally enforces a bounded evidence envelope before model composition and a final full-input preflight at the AI Router boundary.

## Fail-closed conditions
Ingestion/read must stop or degrade rather than invent progress when:
- project/repository authorization fails;
- repository is outside the allowlist;
- branch/source scope mismatches durable state;
- cursor/state is invalid or incompatible;
- GitHub history diverges from the accepted anchor;
- source identity cannot be established;
- GitHub/provider response is invalid;
- concurrent reconciliation owns the lock;
- evidence cannot be reduced safely within the configured model-input boundary.

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

Already live-confirmed: current repository/branch reading and a substantive repository-derived Telegram answer without `INPUT_TOO_LARGE`. This is necessary evidence, not sufficient closure evidence.

## Required implementation/test scope
Remaining closure coverage includes:
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

Existing repository-read and response-input-budget regression tests stay part of the PDK4.13 protection set.

## Definition of Done
**PDK4.13 CLOSED** only after code, tests, CI, production deployment and the complete real live acceptance sequence all succeed and architecture/roadmap/workflow documentation is synchronized.

Until then: **LIVE ACCEPTANCE / NOT CLOSED**.
