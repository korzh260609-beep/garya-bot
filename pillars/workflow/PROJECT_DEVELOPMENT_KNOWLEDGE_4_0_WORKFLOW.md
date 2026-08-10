# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 WORKFLOW

## Status
In progress. **PDK4.1–PDK4.2 CLOSED and CI-verified.** PDK4.3–PDK4.12 remain planned.

## Purpose
Defines the implementation and verification procedure for PDK4. It does not redefine the architecture or create a parallel memory system.

## Mandatory sequence for every PDK4 stage

```text
scope
→ contracts
→ skeleton
→ config
→ minimal logic
→ tests
→ PostgreSQL/restart evidence where applicable
→ observability/diagnostics
→ safety/security review
→ architecture consistency check
→ reversible commit
→ CI/runtime evidence
→ canonical documentation synchronization
```

## Required boundaries
- Work from `../architecture/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0.md` and `../roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md`.
- Reuse Project Memory 3.0 for durable facts, provenance, trust, confirmation, temporal history, deduplication/conflicts, retrieval and Context Guard.
- Do not create a second project-memory database or independent authority path.
- Historical source processing must be bounded, resumable and idempotent.
- Source cursors/checkpoints must be durable across restart.
- Raw chat/model output cannot self-confirm.
- AI assistance uses AI Router only and cannot directly mutate Project Memory.
- Source evidence and derived summaries must remain distinguishable.
- `implemented`, `ci-verified`, `deployed` and `live-verified` are separate evidence states.
- Historical/superseded facts remain queryable but cannot override current-state retrieval.
- Missing evidence creates uncertainty/gaps rather than invented truth.
- No secrets/private user data/authority grants may enter development knowledge.
- PDK4 cannot grant identity, roles, permissions, ownership or resource authority.
- All GitHub/other connector access remains subject to approved connection, resource and owner-security boundaries.

## Historical Bootstrap workflow

```text
resolve authorized repository/project
→ discover earliest relevant verified evidence
→ initialize durable bootstrap cursor
→ fetch bounded source batch
→ verify/normalize source identities
→ deterministic significance prefilter
→ bounded AI-assisted extraction only when needed
→ cluster/correlate events
→ emit PM3 candidates
→ PM3 dedup/conflict/confirmation/temporal pipeline
→ persist checkpoint
→ repeat
→ reconcile timeline/components/current snapshot
→ mark bootstrap complete only after gap/integrity checks
```

A failed batch must not advance the durable cursor beyond uncommitted source processing.

### Implemented PDK4.2 checkpoint discipline
- source history is requested oldest-first in bounded batches;
- cursor identity is scoped by project, source kind and repository/source scope;
- `pdk4_processed_sources` is bookkeeping only and is not a Project Memory fact store;
- source callback completion precedes checkpoint commit;
- processed-source rows and cursor advancement are persisted in one PostgreSQL transaction;
- cursor conflict, source failure and source stall fail closed;
- restart resumes from the last committed cursor;
- completed replay performs no additional history fetch;
- accepted PM3 facts are not created by PDK4.2 and therefore cannot be promoted by scanner bookkeeping.

PDK4.2 verification is covered by `tests/projectDevelopmentKnowledge4HistoricalScanner.test.js`, including a real PostgreSQL close/restart/resume sequence and replay-idempotency assertions. The complete repository gate passed in SG 2.1 CI #7053 before final documentation synchronization.

## Continuous ingestion workflow

```text
verified new source trigger
→ read durable cursor
→ fetch/process only unseen source events
→ normalize/classify/extract/correlate
→ PM3 candidate pipeline
→ reconcile affected components/timeline
→ update rebuildable snapshot
→ advance cursor transactionally
→ emit bounded observability
```

Retries/replays must not duplicate accepted facts.

## Evidence hierarchy
PDK4 records evidence dimensions rather than collapsing them:

```text
idea/plan
< implementation evidence
< test/CI evidence
< deployment evidence
< live runtime verification
```

A higher state requires evidence appropriate to that state. Old documentation, user statements or model summaries cannot silently promote state.

## AI assistance workflow
Before any model call:
- scope is authorized;
- source material is bounded;
- secrets/private content are excluded;
- repository/external embedded instructions are marked data-only;
- operation is classified as extraction/classification/clustering/summarization;
- request is routed through AI Router with trace/cost/reason metadata.

After the model call:
- output is treated as a candidate/derived interpretation;
- deterministic validation runs;
- source provenance remains attached;
- PM3 trust/confirmation decides whether anything becomes active knowledge.

## Required tests by stage
Each stage must include the applicable subset of:
- contract validation;
- cross-project denial;
- source verification failure;
- deterministic fingerprint/idempotency;
- restart/resume continuity;
- batch boundary correctness;
- low-significance noise suppression;
- significant-change retention;
- AI unavailable/failure fallback;
- no direct AI-to-store mutation;
- conflict visibility;
- temporal supersession/current-vs-history;
- no CI→deployment promotion;
- no deployment→live promotion;
- secret/private-content exclusion;
- embedded-instruction data isolation;
- unauthorized connector/resource denial;
- snapshot rebuild consistency;
- timeline integrity;
- normal SG answer integration through PM3 Context Guard.

## Required diagnostics
By PDK4.12 the production diagnostic surface must expose bounded checks/metadata for:

```text
development_history_health
historical_bootstrap_status
historical_bootstrap_cursor
commits_scanned
events_extracted
events_confirmed
events_rejected
events_superseded
unresolved_conflicts
unlinked_source_events
timeline_integrity
component_registry_health
current_snapshot_health
continuous_ingestion_health
last_successful_ingestion
reconciliation_gap_count
source_gap_check
```

Diagnostics must not dump raw repository history, private conversation content or secrets.

## Production acceptance workflow
PDK4.12 must prove one complete chain using the real SG repository/source path:

```text
earliest verified repository evidence
→ bounded historical bootstrap
→ Development Events
→ PM3 durable facts/relations/history
→ ProjectGenesis + Product Timeline + Component Histories
→ ProjectSnapshot
→ process restart
→ resume/integrity verification
→ new real source change after bootstrap cursor
→ incremental ingestion only
→ ordinary SG question
→ PM3 retrieval + Context Guard
→ evidence-aware answer with provenance/currentness
```

Acceptance must also prove:
- replay does not duplicate knowledge;
- stale/superseded facts do not become current truth;
- roadmap/code/CI/deployment/runtime discrepancies remain visible;
- unsupported live connectors fail closed;
- raw chat/model output cannot self-confirm;
- no authority/security boundary is changed by memory content.

## Completion rule
A PDK4 stage is CLOSED only when its code, tests, CI and required runtime/database evidence pass and all affected canonical documents are synchronized. PDK4 overall is CLOSED only after PDK4.12 production acceptance.