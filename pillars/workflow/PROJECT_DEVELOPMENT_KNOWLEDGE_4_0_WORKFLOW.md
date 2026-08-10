# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 WORKFLOW

## Status
In progress. **PDK4.1–PDK4.9 CLOSED and CI-verified.** PDK4.10–PDK4.12 remain planned.

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
→ bounded AI-assisted significance classification only when ambiguous
→ development-event extraction
→ cluster/correlate events
→ emit PM3 candidates
→ PM3 dedup/conflict/confirmation/temporal pipeline
→ persist checkpoint
→ repeat
→ reconstruct ProjectGenesis/ProductTimeline/ComponentHistories
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

### Implemented PDK4.3 source verification discipline
- source normalization is read-only and cannot mutate Project Memory;
- repository access requires an explicit approved-repository allowlist;
- GitHub commit verification binds to immutable commit SHA;
- PR verification binds to PR number plus immutable head SHA;
- workflow verification binds to run id plus attempt;
- canonical documents bind to path plus revision SHA;
- source text/diffs/docs are bounded, secret-redacted and tagged `untrusted-data-only`;
- commit/PR evidence may provide `code` verification;
- only a verified successful workflow may provide `ci` verification;
- canonical documents provide `source` verification only and cannot prove implementation state;
- deployment/runtime sources remain unavailable until real approved connectors exist;
- network/provider failure, weak records, identity mismatch and repository policy denial fail closed;
- scanner bookkeeping is never treated as equivalent to source verification.

PDK4.3 verification is covered by `tests/projectDevelopmentKnowledge4SourceNormalization.test.js`, including production-style GitHub REST request-contract tests, source mismatch/allowlist/network failure tests, secret redaction, bounded diffs, evidence-dimension separation and scanner→normalizer integration. The complete repository code gate passed in SG 2.1 CI #7067 before final documentation synchronization.

### Implemented PDK4.4 significance discipline
- classification accepts only PDK4.3 `verified-source` + `untrusted-data-only` envelopes and fails closed otherwise;
- deterministic metadata/path/diff classification runs before any model assistance;
- architecture, behavior, feature, memory, identity, security, integration, persistence, infrastructure, roadmap, incident/fix and other meaningful categories are bounded by the executable contract;
- generated-only, whitespace-only and explicit formatting/lint/typo churn is suppressed before AI Router;
- workflow sources remain supporting CI/source evidence and are not standalone product-change events;
- canonical architecture/roadmap/workflow documents may be significant while retaining their original source-only evidence semantics;
- AI Router is used only for bounded ambiguous classifications and receives repository material as untrusted data only;
- model output cannot assign trust, confirmation, deployment/runtime state, identity, role, permission, ownership or authority;
- malformed or unavailable model assistance falls back to the deterministic ambiguous result instead of dropping source evidence;
- classification results have deterministic fingerprints and remain `classification-only`;
- PDK4.4 has no direct Project Memory write/confirmation path.

PDK4.4 verification is covered by `tests/projectDevelopmentKnowledge4SignificanceClassifier.test.js`, including significant-change retention, generated/trivial suppression, workflow evidence separation, canonical-document evidence preservation, bounded Router-only ambiguity handling, deterministic fallback and fail-closed envelope tests. The complete repository code gate passed in SG 2.1 CI #7075 on commit `41276bc952c6eb51e107c532b65a885be00238d6` before final documentation synchronization.

### Implemented PDK4.5 extraction discipline
- extraction accepts only a verified PDK4.3 source paired with the matching PDK4.4 classification fingerprint;
- suppressed and supporting-evidence-only classifications cannot become standalone DevelopmentEvents;
- deterministic extraction provides a bounded event type, Project Memory domain, component and evidence-compatible lifecycle transition before model assistance;
- every event preserves immutable source provenance, `derivedFrom` source id and verification entries copied from verified evidence;
- AI assistance is Router-only, receives bounded `untrusted-data-only` evidence and cannot confirm facts or assign authority;
- model fields are bounded and secret-shaped output is redacted before DevelopmentEvent creation;
- model output cannot promote code evidence to deployed/live state or source-only evidence to implemented state;
- malformed or unavailable AI falls back deterministically;
- resulting DevelopmentEvent is adapted only to a PM3 `project-event` candidate with `trust=unverified`, `confirmed=false`, `confirmationState=proposed`;
- PDK4.5 has no Project Memory store write or self-confirmation path;
- deterministic semantic/extraction fingerprints support replay consistency.

PDK4.5 verification is covered by `tests/projectDevelopmentKnowledge4EventExtraction.test.js`, including provenance/state extraction, replay determinism, non-event-eligible denial, classification/source mismatch denial, bounded Router enrichment, anti-promotion checks, source-only roadmap behavior, provider-failure fallback and secret-output redaction. The complete repository code gate passed in SG 2.1 CI #7084 on commit `d8eb324b6ecc19697f75b6d884e8b79638d15868` before final documentation synchronization.

### Implemented PDK4.6 clustering discipline
- clustering accepts only PDK4.5 extracted candidates whose PM3 candidate remains `unverified`, unconfirmed and `proposed`;
- deterministic project/domain/normalized-component/time/semantic compatibility runs before any model assistance;
- project, domain, component or temporal incompatibility is a hard split that AI cannot override;
- sufficiently strong compatible semantic overlap may merge deterministically;
- only an ambiguous hard-compatible pair may invoke AI Router;
- Router receives bounded data-only event material and may decide only merge/split;
- AI cannot create trust, confirmation, evidence, lifecycle state, deployment/runtime claims, identity, roles, permissions, ownership or authority;
- malformed or unavailable AI deterministically falls back to split rather than merging uncertain changes;
- each milestone preserves every unique atomic provenance reference and only the verification already present on clustered atomic events;
- each atomic event yields an explicit `belongs-to-milestone` relation-link record to the derived milestone;
- PDK4.4 `supporting-evidence` sources may attach only through explicit links to known atomic event ids;
- supporting workflow/CI evidence remains audit/correlation metadata and cannot independently promote the milestone lifecycle or verification state;
- cluster and aggregate fingerprints are deterministic for replay/audit consistency;
- milestone output remains an unverified/proposed PM3 candidate and PDK4.6 has no direct Project Memory write/confirmation path.

PDK4.6 verification is covered by `tests/projectDevelopmentKnowledge4Clustering.test.js`, including coherent multi-commit clustering, distinct-change separation, hard component/domain/time boundaries, supporting-CI non-promotion, explicit support-link validation, cross-project and mutated-input denial, Router-only ambiguous merge assistance and deterministic AI-failure fallback. The complete repository gate passed in SG 2.1 CI #7092 on commit `02b2d8c0cce035e6a954354814f7d5002fb4d5b4` before final documentation synchronization.

### Implemented PDK4.7 historical reconstruction discipline
- reconstruction accepts only complete, project-consistent PDK4.5 extraction output plus non-authoritative PDK4.6 clustering output;
- every atomic event must appear in exactly one milestone cluster, so timeline reconstruction cannot silently omit or duplicate development evidence;
- all derived views remain rebuildable and non-authoritative: no new persistence layer and no direct Project Memory mutation;
- `ProjectGenesis` is derived from evidence-backed events and milestones, including earliest verified evidence, first relevant commit, initial architecture evidence, first working milestone, foundational decisions and major evolution milestones;
- `originalIdea` and `originalGoal` are populated only when explicit origin/requirement evidence exists; missing history remains unknown rather than inferred;
- earliest verified evidence is explicitly qualified as earliest-known evidence, never as an exact creation date;
- `ProductTimeline` is chronological and milestone-based while retaining source ids and atomic-event links;
- `ComponentHistory` preserves atomic events and milestone summaries for each component;
- superseded/historical decisions remain present with lifecycle and supersession metadata rather than being deleted;
- bounded development phases are reconstructed from event semantics and evidence-compatible lifecycle states;
- deterministic reconstruction fingerprints are independent of input ordering and support replay consistency;
- PDK4.7 does not call AI and cannot create trust, confirmation, roles, permissions, ownership or authority.

PDK4.7 verification is covered by `tests/projectDevelopmentKnowledge4HistoricalReconstruction.test.js`, including earliest-evidence qualification, genesis/timeline/component-history reconstruction, input-order fingerprint stability, superseded-history retention, unknown-origin handling, incomplete-clustering denial, cross-project denial and mutated-authoritative input denial. The complete repository gate passed in SG 2.1 CI #7100 on commit `14445ad7cfc413c241cccc759359bfb018cb2022` before final documentation synchronization.

### Implemented PDK4.8 temporal/causal reconciliation discipline
- reconciliation accepts only matching non-authoritative PDK4.5 extraction, complete PDK4.6 clustering and PDK4.7 historical reconstruction outputs;
- duplicate/cross-project events, incomplete cluster coverage, authoritative/mutated candidates and mismatched reconstruction counts fail closed;
- temporal order is deterministic and project/domain/component scoped before derived links are created;
- explicit event relations remain authoritative only as source-backed relation data; unknown relation targets become `missing-causal-link` gaps;
- PDK4.6 `belongs-to-milestone` relations are retained rather than recomputed from text similarity;
- bounded causal linking may derive `motivated-by`, `implements` and `fixes` only from prior compatible events in the same project/domain/component scope;
- code/implemented evidence may link only to later CI evidence using `verified-by-ci`; CI may link only to later deployment evidence using `deployed-as`; deployment may link only to later runtime evidence using `verified-in-runtime`;
- explicit `supersedes` / `supersededBy` references produce paired `supersedes` / `superseded-by` links; absent targets remain explicit gaps;
- explicit `depends-on` and other canonical PDK4 relation types are preserved when their referenced events exist and are never invented from weak similarity;
- component reconciliation records source/roadmap-plan, code, test, CI, deployment and runtime evidence separately;
- missing CI after code, missing deployment after CI and missing runtime after deployment create bounded evidence gaps instead of lifecycle promotion;
- active plans that predate later delivery evidence without close/supersession are reported as `stale-plan`;
- successive active decision/plan records without an explicit supersession relationship create `missing-supersession` gaps;
- contradictory evidence chronology remains visible as `temporal-evidence-order` rather than being silently reordered;
- gap records and gap candidates remain derived/unverified/unconfirmed/proposed and cannot grant authority or directly mutate Project Memory;
- reconciliation and gap identities are deterministic and replay-stable;
- PDK4.8 performs no AI call.

PDK4.8 verification is covered by `tests/projectDevelopmentKnowledge4TemporalCausalReconciliation.test.js`, including full code→CI→deployment→runtime separation/linking, missing evidence gaps, stale-plan handling, incident→fix correlation, explicit/missing supersession, contradictory chronology, input-order determinism and fail-closed cross-project/authoritative/mismatched-history cases. The complete repository code gate passed in SG 2.1 CI #7108 on commit `4873fa255fc916cb5a6ea120e26b69870d941ee6` before final documentation synchronization.

### Implemented PDK4.9 continuous ingestion discipline
- continuous ingestion is allowed only after the matching PDK4.2 GitHub historical cursor is complete;
- the bootstrap `lastSourceId` must be a canonical GitHub commit identity and its full immutable SHA initializes the incremental cursor;
- polling always starts from the durable incremental SHA, never from `null`, so PDK4.9 cannot silently restart full historical scanning;
- trigger types are bounded to `poll`, `webhook` and internal `event`; webhook payload is a trigger only and does not become verified source evidence;
- repository mismatch is rejected before processing; each unseen commit is independently normalized/re-verified through PDK4.3 by immutable SHA;
- trigger receipts are durable with `processing`, `completed`, `failed` lifecycle; completed/in-flight duplicate delivery is suppressed while failed delivery is retryable;
- each processed commit has durable source identity/fingerprint and restart-safe idempotency;
- PDK4.4-suppressed/non-event commits still advance bookkeeping so they cannot loop forever, but they never enter PDK4.5 or Project Memory;
- event-eligible commits reuse the existing source normalization/classification/extraction pipeline and may write only unverified/unconfirmed PM3 candidates;
- incremental reconciliation remains derived/unconfirmed/non-authoritative;
- authorization is checked before GitHub fetch and observability emits bounded trigger/source status only;
- cross-project/source mismatch, bootstrap drift, invalid bootstrap anchor and attempted trust/authority promotion fail closed.

PDK4.9 verification is covered by `tests/projectDevelopmentKnowledge4ContinuousIngestion.test.js` plus `tests/postgresPersistence.test.js`. Coverage includes strict post-bootstrap SHA start, trigger/source replay idempotency, failed-trigger retry, webhook repository denial, suppressed-source no-PM3 behavior, authorization/bootstrap denial, immutable re-verification, PostgreSQL restart continuity and migration compatibility. Full repository code gate passed in SG 2.1 CI #7129 on commit `963ca2c1dec84fdff6e582e49df7b72cbb3d6500` before final documentation synchronization.

## Continuous ingestion workflow

```text
completed historical bootstrap
→ resolve immutable bootstrap commit SHA
→ authorize trigger/project/repository
→ read durable incremental cursor
→ fetch bounded unseen commits only
→ re-verify immutable commit source
→ classify significance
→ suppress/bookkeep non-events OR extract event
→ unconfirmed PM3 candidate pipeline
→ reconcile affected development knowledge without promotion
→ commit processed-source/cursor state
→ complete trigger receipt
→ emit bounded observability
```

Webhook/event delivery is a wake-up signal only. It cannot substitute for GitHub source verification. Failed trigger execution is marked retryable; replay of completed trigger/source identities must not duplicate accepted facts or cursor progress.

## Evidence hierarchy
PDK4 records evidence dimensions rather than collapsing them:

```text
source/plan evidence
< implementation/code evidence
< test/CI evidence
< deployment evidence
< live runtime verification
```

A higher state requires evidence appropriate to that state. Old documentation, user statements or model summaries cannot silently promote state. Canonical repository documents remain source evidence unless independently corroborated by implementation/CI/deployment/runtime evidence.

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

PDK4.7 historical reconstruction and PDK4.8 temporal/causal reconciliation are deterministic and perform no model call; they rebuild/relate already bounded PDK4 outputs without manufacturing evidence. PDK4.9 does not add a new AI path: any classification/extraction assistance remains exclusively inside the existing PDK4.4/PDK4.5 AI Router boundaries.

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