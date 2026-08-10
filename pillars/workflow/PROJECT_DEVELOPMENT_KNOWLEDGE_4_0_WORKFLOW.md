# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 WORKFLOW

## Status
In progress. **PDK4.1–PDK4.11 CLOSED and CI-verified.** PDK4.12 remains planned.

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
- Reuse Project Memory 3.0 for durable facts, provenance, trust, confirmation, temporal history, deduplication/conflicts, retrieval and Context Guard.
- Never create a second project-memory database or independent authority path.
- Historical and continuous source processing must be bounded, resumable and idempotent.
- Raw chat/model output cannot self-confirm.
- AI assistance uses AI Router only and cannot directly mutate Project Memory.
- `implemented`, `ci-verified`, `deployed` and `live-verified` are separate evidence states.
- Historical/superseded facts remain queryable but cannot override current-state retrieval.
- Missing evidence creates uncertainty/gaps rather than invented truth.
- No secrets/private user data/authority grants may enter development knowledge.
- PDK4 cannot grant identity, roles, permissions, ownership or resource authority.
- All connector access remains subject to approved connection, resource and owner-security boundaries.

## Historical Bootstrap workflow

```text
resolve authorized repository/project
→ discover earliest relevant verified evidence
→ initialize durable bootstrap cursor
→ fetch bounded source batch
→ verify/normalize source identities
→ deterministic significance prefilter
→ bounded AI-assisted classification only when ambiguous
→ development-event extraction
→ cluster/correlate events
→ emit PM3 candidates
→ PM3 dedup/conflict/confirmation/temporal pipeline
→ persist checkpoint
→ repeat
→ reconstruct ProjectGenesis/ProductTimeline/ComponentHistories
→ reconcile relations/evidence gaps
→ rebuild component registry/current snapshot
```

A failed batch must not advance the durable cursor beyond uncommitted source processing.

## Implemented stage disciplines

### PDK4.2 — historical cursor
- oldest-first bounded batches;
- project/source/repository-scoped PostgreSQL cursor;
- processed-source bookkeeping is not Project Memory truth;
- batch callback completion precedes transactional checkpoint commit;
- restart resumes from last committed cursor;
- completed replay performs no additional history fetch.

Verification: `tests/projectDevelopmentKnowledge4HistoricalScanner.test.js`; CI #7053.

### PDK4.3 — source verification
- explicit approved-repository allowlist;
- immutable commit SHA / PR head SHA / workflow run+attempt / document revision binding;
- bounded secret-redacted `untrusted-data-only` content;
- commit/PR may prove code; successful workflow may prove CI; canonical docs prove source only;
- unavailable deployment/runtime connectors fail closed.

Verification: `tests/projectDevelopmentKnowledge4SourceNormalization.test.js`; CI #7067.

### PDK4.4 — significance
- deterministic prefilter before AI;
- generated/formatting/trivial churn suppression;
- supporting CI evidence separated from product-change events;
- AI Router only for bounded ambiguous classification;
- classification cannot create trust, state, permission or authority.

Verification: `tests/projectDevelopmentKnowledge4SignificanceClassifier.test.js`; CI #7075.

### PDK4.5 — extraction
- only matching verified PDK4.3 + event-eligible PDK4.4 inputs;
- immutable provenance and evidence-compatible lifecycle state;
- Router-only semantic enrichment;
- PM3 output remains `unverified`, unconfirmed and proposed;
- no direct Project Memory mutation.

Verification: `tests/projectDevelopmentKnowledge4EventExtraction.test.js`; CI #7084.

### PDK4.6 — clustering
- hard project/domain/component/time boundaries;
- every atomic event retained and auditable;
- supporting evidence cannot promote milestone state;
- AI can advise merge/split only for bounded ambiguity;
- milestone output remains unverified/proposed.

Verification: `tests/projectDevelopmentKnowledge4Clustering.test.js`; CI #7092.

### PDK4.7 — historical reconstruction
- complete project-consistent atomic/clustering input required;
- deterministic ProjectGenesis, ProductTimeline, ComponentHistory and development phases;
- earliest verified evidence is not treated as exact creation date;
- superseded historical truth remains visible;
- no AI and no direct PM3 write.

Verification: `tests/projectDevelopmentKnowledge4HistoricalReconstruction.test.js`; CI #7100.

### PDK4.8 — temporal/causal reconciliation
- deterministic same-project/domain/component relations;
- source/code/test/CI/deployment/runtime dimensions remain separate;
- missing CI/deployment/runtime, stale plan, missing supersession and contradictory chronology become explicit gaps;
- gaps remain unverified/non-authoritative;
- no AI and no direct PM3 promotion.

Verification: `tests/projectDevelopmentKnowledge4TemporalCausalReconciliation.test.js`; CI #7108.

### PDK4.9 — continuous GitHub ingestion
- runs only after completed PDK4.2 bootstrap;
- immutable historical SHA initializes incremental cursor;
- bounded poll/webhook/event triggers;
- webhook is wake-up metadata only; each commit is re-verified by immutable SHA;
- durable trigger lifecycle `processing → completed|failed`;
- source replay/restart idempotency;
- suppressed commits advance bookkeeping without creating PM3 facts;
- event-eligible output remains unconfirmed PM3 candidate;
- authorization runs before GitHub fetch.

Verification: `tests/projectDevelopmentKnowledge4ContinuousIngestion.test.js` + PostgreSQL compatibility; CI #7129.

### PDK4.10 — component registry/current snapshot
- input facts are project-scope checked through PM3 contracts;
- only confirmed PM3 `project-event` facts may determine current state;
- proposed/unconfirmed candidates are ignored for state promotion and counted separately;
- superseded/archived historical events remain historical but are excluded from current evidence dimensions;
- source/code/test/CI/deployment/runtime are computed independently per component;
- active decisions, issues, incidents, implementation work and next plans remain separate collections;
- PDK4.8 dependency/gap/contradiction output is informational only and must remain non-authoritative;
- registry/snapshot fingerprints are deterministic across fact/gap input ordering and exclude generation timestamp from semantic identity;
- empty confirmed knowledge returns unknown/empty state instead of invented facts;
- no new persistence layer is introduced.

Verification: `tests/projectDevelopmentKnowledge4ComponentSnapshot.test.js`; full repository code gate passed in SG 2.1 CI #7140 on commit `c70438935a8c7e764ce5c21351fac2025aac4a65` before documentation synchronization.

### PDK4.11 — development query/normal SG answer integration
- classify ordinary development questions into `current`, `historical`, `evolution`, `rationale`, `evidence`, `comparison`, `planning`, `incident-history` or `genesis`;
- current/evidence/planning mode reuses the normal PM3 guarded request path;
- historical modes explicitly reuse PM3 Hybrid Retrieval and Context Guard with bounded active/superseded and current/superseded/expired qualification;
- authorize resolved project scope before historical retrieval and fail closed on cross-project mismatch;
- admit only relevant GitHub-trusted development facts to the bounded answer context;
- preserve provenance, currentness and open evidence conflicts;
- inject `DevelopmentQueryContext` into ordinary `compose-answer` through AI Router only;
- historical/superseded facts cannot become current truth without current evidence;
- incident-history similarity remains advisory-only and cannot establish a live root cause;
- Project Memory/PDK4 context is data-only and cannot grant identity, roles, permissions, ownership, authority, trust or confirmation;
- AI failure/invalid output falls back to qualified deterministic Project Memory output.

Verification: `tests/projectDevelopmentKnowledge4DevelopmentQueryIntegration.test.js`; full repository code/runtime/worker/diagnostics gate passed in SG 2.1 CI #7153 on commit `a502d5b0252807747f7d4e660d1967752fcf90e5` before documentation synchronization.

## Continuous ingestion → snapshot workflow

```text
completed historical bootstrap
→ incremental verified GitHub change
→ PM3 candidate pipeline
→ confirmation/trust remains PM3-owned
→ deterministic PDK4.8 reconciliation
→ select confirmed current PDK4 facts
→ rebuild Product Component Registry
→ rebuild Current Project Snapshot
→ preserve unresolved gaps and evidence qualification
```

The snapshot is a rebuildable projection, not an independent durable source of truth.

## Development query → normal SG answer workflow

```text
ordinary SG development question
→ deterministic PDK4.11 query mode
→ resolved project-scope authorization
→ PM3 Hybrid Retrieval
→ PM3 Context Guard
→ bounded DevelopmentQueryContext
→ AI Router response composition
→ final-response validation
→ qualified deterministic PM3 fallback when AI is unavailable/invalid
```

Historical modes explicitly preserve superseded/expired qualification. Incident-history similarity is advisory-only and does not replace Universal Diagnostics/live evidence.

## Evidence hierarchy

```text
source/plan evidence
< implementation/code evidence
< test/CI evidence
< deployment evidence
< live runtime verification
```

Higher evidence must never be inferred from weaker evidence. Roadmap status, old documentation, user statements or model summaries cannot silently promote state.

## AI assistance workflow
Before any model call:
- scope is authorized;
- source material is bounded;
- secrets/private content are excluded;
- embedded instructions are data-only;
- request is routed through AI Router with trace/cost/reason metadata.

After the model call:
- output remains candidate/derived interpretation;
- deterministic validation runs;
- provenance remains attached;
- PM3 trust/confirmation decides whether anything becomes active knowledge.

PDK4.7, PDK4.8 and PDK4.10 are deterministic and perform no model call. PDK4.9 adds no direct AI path; any assistance remains inside PDK4.4/PDK4.5. PDK4.11 uses only the existing AI Router response-composition path after PM3 retrieval/Context Guard.

## Required tests by stage
Applicable coverage includes:
- contract validation and cross-project denial;
- source verification failure;
- deterministic fingerprint/idempotency;
- restart/resume and batch boundaries;
- low-significance suppression and significant-change retention;
- AI failure fallback and no AI-to-store mutation;
- conflict/supersession/current-vs-history visibility;
- no CI→deployment or deployment→live promotion;
- secret/private-content exclusion;
- connector/resource authorization denial;
- snapshot rebuild consistency;
- timeline integrity;
- normal SG answer integration through PM3 Context Guard.

## Required diagnostics
By PDK4.12 expose bounded secret-safe checks/metadata for:

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

## Production acceptance workflow
PDK4.12 must prove:

```text
earliest verified repository evidence
→ bounded historical bootstrap
→ Development Events
→ PM3 durable facts/relations/history
→ ProjectGenesis + Product Timeline + Component Histories
→ reconciliation
→ Product Component Registry + ProjectSnapshot
→ process restart
→ incremental new real source change
→ ordinary SG question
→ PM3 retrieval + Context Guard
→ evidence-aware answer with provenance/currentness
```

Acceptance must also prove replay idempotency, stale/superseded isolation, evidence-dimension separation, unavailable connector fail-closed behavior, no raw-chat/model self-confirmation and no authority changes from memory content.

## Completion rule
A PDK4 stage is CLOSED only when code, tests, CI and required runtime/database evidence pass and affected canonical documents are synchronized. PDK4 overall is CLOSED only after PDK4.12 production acceptance.