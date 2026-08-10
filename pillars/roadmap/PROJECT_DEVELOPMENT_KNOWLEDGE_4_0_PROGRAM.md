# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 PROGRAM

## Status
In progress. **PDK4.1–PDK4.11 CLOSED and CI-verified.** PDK4.12 remains planned.

Project Development Knowledge 4.0 (PDK4) is a cross-cutting program built on the completed Project Memory 3.0 foundation. It does not renumber Blocks 0–19 and does not reopen PM3.1–PM3.12.

## Goal
Make SG continuously maintain an evidence-backed project biography of its own development: how ideas originated, why decisions were made, how implementation evolved, what was reworked, what failed, how it was fixed, what evidence verifies each state, what is current now and what is planned next.

PDK4 stores durable knowledge only through Project Memory 3.0 and preserves all PM3 trust, provenance, confirmation, temporal, conflict, scope and Context Guard rules.

## Canonical implementation order

### PDK4.1 — Development Knowledge Contract & Taxonomy
**Status: CLOSED / CI-verified.**

Implemented:
- executable `DevelopmentEvent` contract;
- canonical event types, development states and relation types;
- deterministic development-source identities/fingerprints;
- ProjectGenesis, ProductTimeline, ComponentHistory and ProjectSnapshot derived-view contracts;
- recursive rejection of secrets, authority-bearing fields and private-user fields;
- project-scope checks for provenance, verification and relations;
- explicit evidence requirements preventing silent CI→deployment and deployment→live promotion;
- explicit supersession lifecycle requirements;
- adapter from DevelopmentEvent to an unconfirmed PM3 `project-event` candidate, preserving Project Memory 3.0 as the only durable project-memory layer.

Implementation:
- `src/projectDevelopmentKnowledge/developmentKnowledgeContract.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4Contract.test.js`
- `npm run test:project-development-knowledge`

**Gate:** PASSED — contracts reject secret/authority/private-user payloads, cross-project mismatch, unsupported taxonomy and invalid/evidence-free lifecycle/state promotion. Full `npm run check` passed in SG 2.1 CI #7045.

### PDK4.2 — GitHub Historical Scanner & Durable Cursor
**Status: CLOSED / CI-verified.**

Implemented:
- bounded oldest-first GitHub commit history scanner contract;
- configurable batch bounds (`1..200`, default `50`) and bounded bootstrap loop;
- repository/project/source-scoped durable cursor and checkpoint state in PostgreSQL;
- separate `pdk4_processed_sources` bookkeeping, explicitly outside Project Memory facts;
- deterministic commit source identity/fingerprint and replay detection;
- transactional batch commit: processed-source bookkeeping and cursor advancement commit together;
- optimistic cursor conflict detection with fail-closed behavior;
- restart/resume from the last committed cursor;
- completed-cursor replay idempotency with no history refetch;
- failed source processing leaves cursor unadvanced;
- stalled history source detection instead of invented progress;
- PostgreSQL migration and migration compatibility coverage.

Implementation:
- `src/projectDevelopmentKnowledge/githubHistoricalScanner.js`
- `src/projectDevelopmentKnowledge/postgresHistoricalCursorStore.js`
- `src/persistence/migrations/901_pdk4_historical_cursor.sql`
- `tests/projectDevelopmentKnowledge4HistoricalScanner.test.js`
- `tests/postgresPersistence.test.js`
- `npm run test:project-development-knowledge`

Evidence:
- PDK4.2 scanner tests prove bounded chronological batches, replay idempotency, fail-closed source failure and stalled-source handling;
- PostgreSQL integration proves cursor persistence across service restart and resumption without duplicate processed sources;
- migration compatibility tests include the PDK4.2 migration and preserve SG 2.0 upgrade behavior;
- full code gate passed after updating the canonical migration-count fixture from 25 to 26.

**Gate:** PASSED — historical scan bookkeeping resumes after PostgreSQL restart without duplicate processed-source records or skipped cursor ranges. PDK4.2 does not directly create accepted PM3 facts; later normalization/extraction stages remain responsible for emitting candidates through the existing PM3 idempotency/trust pipeline. Full CI passed in SG 2.1 CI #7053 before final documentation synchronization.

### PDK4.3 — Source Normalization & Verification
**Status: CLOSED / CI-verified.**

Implemented:
- production-capable read-only GitHub REST verifier for commits, pull requests, workflow runs/jobs and canonical repository files at immutable revisions;
- explicit approved-repository allowlist and fail-closed connector/network/provider behavior;
- deterministic normalized source envelopes with immutable source identity, source fingerprint and normalized fingerprint;
- bounded commit messages, diffs, PR text/files, workflow metadata/jobs and canonical document content;
- secret-shaped text redaction before normalized repository content can move downstream;
- `contentMode: untrusted-data-only` so repository text and embedded instructions remain data, never executable instructions;
- commit/PR evidence classified as `code` evidence;
- successful workflow runs classified as `ci` evidence, while failed/non-success runs remain only source-verified and cannot claim CI verification;
- canonical documents classified only as `source` evidence and explicitly prevented from proving implementation by themselves;
- deployment/runtime source kinds remain unavailable until real approved connectors exist;
- scanner→normalizer integration coverage proving historical sources can feed verified normalized source events without direct Project Memory mutation.

Implementation:
- `src/projectDevelopmentKnowledge/sourceNormalizationVerification.js`
- `src/projectDevelopmentKnowledge/githubDevelopmentSourceVerifier.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4SourceNormalization.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- deterministic commit normalization and replay fingerprint tests;
- bounded patch/file-count tests;
- immutable PR head SHA and workflow run/attempt identity tests;
- canonical document revision binding and source-only evidence tests;
- approved repository denial, weak/mismatched source denial and unavailable deployment/runtime connector tests;
- real REST adapter request-contract tests for commit/PR/workflow/document paths;
- secret-redaction and network fail-closed tests;
- historical scanner integration test feeding only verified normalized events downstream.

**Gate:** PASSED — every accepted normalized source event has deterministic immutable provenance, bounded secret-safe data and explicit evidence semantics. Weak/mismatched/unapproved/unavailable sources fail closed; canonical docs cannot promote code state; CI success cannot imply deployment/live state. Full code gate passed in SG 2.1 CI #7067 before final documentation synchronization.

### PDK4.4 — Development Significance Classifier
**Status: CLOSED / CI-verified.**

Implemented:
- deterministic metadata/path/diff prefilter before any model assistance;
- canonical significance levels for suppressed noise, supporting evidence, significant changes and ambiguous changes;
- deterministic classification across architecture, behavior, feature, memory, identity, security, integration, persistence, infrastructure, roadmap, incident/fix and other meaningful changes;
- generated-only, whitespace-only and explicit formatting/lint/typo churn suppression before AI Router;
- verified workflow runs retained as supporting evidence without becoming standalone product-change events;
- canonical architecture/roadmap/workflow documents retained as significant source evidence without upgrading their PDK4.3 evidence dimension;
- AI Router invoked only for bounded ambiguous changes and never for deterministic significant/trivial outcomes;
- bounded data-only AI payloads with explicit prohibition on trust, verification, deployment/runtime state, roles, permissions, ownership or authority decisions;
- malformed/unavailable AI assistance falls back deterministically without dropping ambiguous evidence;
- deterministic classification fingerprints for replay/audit consistency;
- verified-source and `untrusted-data-only` envelope requirements fail closed;
- classifier remains classification-only and cannot write or confirm Project Memory directly.

Implementation:
- `src/projectDevelopmentKnowledge/developmentSignificanceClassifier.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4SignificanceClassifier.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- deterministic significant architecture/memory retention without AI;
- generated/trivial churn suppression before AI;
- workflow supporting-evidence separation;
- canonical roadmap source-only evidence preservation;
- bounded ambiguous classification through AI Router only;
- deterministic trivial outcomes cannot be overridden by AI;
- AI failure fallback remains deterministic and replay-stable;
- unverified or executable-content envelopes fail closed.

**Gate:** PASSED — trivial/generated churn is prevented from becoming development-event input, significant architecture/product evidence is retained, and ambiguous classification stays bounded, Router-only and non-authoritative. Full repository code gate passed in SG 2.1 CI #7075 on commit `41276bc952c6eb51e107c532b65a885be00238d6` before final documentation synchronization.

### PDK4.5 — Development Event Extraction
**Status: CLOSED / CI-verified.**

Implemented:
- bounded extractor accepting only verified PDK4.3 source envelopes paired with matching non-authoritative PDK4.4 classifications;
- suppressed/supporting-only sources rejected from standalone DevelopmentEvent extraction;
- deterministic event type/domain/component/state baseline from source evidence and significance categories;
- extraction of title, summary, intent, problem, rationale, alternatives, implementation, result, limitations and lifecycle transition fields;
- immutable source provenance and verification copied into every DevelopmentEvent;
- evidence-gated state validation prevents source-only/model output from claiming implemented/CI/deployed/live state;
- AI assistance routed only through AI Router with bounded `untrusted-data-only` payload and explicit no-confirm/no-authority metadata;
- malformed/unavailable AI falls back to deterministic extraction;
- secret-shaped AI output is redacted and list/text fields remain bounded;
- deterministic event semantic/extraction fingerprints provide replay consistency;
- output is a `DevelopmentEvent` plus PM3 `project-event` candidate forced to `trust=unverified`, `confirmed=false`, `confirmationState=proposed`;
- extractor has no Project Memory store write path and cannot self-confirm durable truth.

Implementation:
- `src/projectDevelopmentKnowledge/developmentEventExtractor.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4EventExtraction.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- deterministic provenance-backed implementation extraction;
- replay-stable event/extraction fingerprints;
- suppressed/supporting-evidence denial;
- source/classification mismatch and weak-trust fail-closed tests;
- bounded AI semantic enrichment while candidate stays unverified/proposed;
- explicit denial of AI-driven code→deployed/live promotion;
- canonical source-only roadmap evidence cannot claim implemented state;
- malformed/provider-failure deterministic fallback;
- secret-shaped model output redaction and bounded alternatives.

**Gate:** PASSED — model output cannot self-confirm or mutate durable Project Memory; extracted events remain bounded, provenance-backed and evidence-state constrained. Full repository code gate passed in SG 2.1 CI #7084 on commit `d8eb324b6ecc19697f75b6d884e8b79638d15868` before final documentation synchronization.

### PDK4.6 — Commit/Event Clustering & Milestones
**Status: CLOSED / CI-verified.**

Implemented:
- deterministic bounded clustering of PDK4.5 extracted candidates by project, domain, normalized component, temporal proximity and semantic anchors;
- hard project/domain/component/time boundaries preventing semantic similarity from collapsing unrelated product changes;
- bounded milestone `DevelopmentEvent` candidates that preserve every atomic event's immutable provenance and source-level verification;
- deterministic cluster and aggregate fingerprints for replay/audit consistency;
- explicit `belongs-to-milestone` relation-link records from every atomic event to the derived milestone;
- PDK4.4 `supporting-evidence` sources may attach only with explicit links to known atomic event ids;
- supporting CI/workflow evidence remains audit/correlation metadata and cannot promote the milestone lifecycle state or verification set by itself;
- AI Router is used only for ambiguous hard-compatible pairs and receives bounded data-only event material;
- malformed/unavailable AI deterministically falls back to split rather than silently merging changes;
- AI output can decide only merge/split and cannot confirm truth, set trust, mutate lifecycle/evidence, claim deployment/runtime state or grant authority;
- milestone output remains `trust=unverified`, `confirmed=false`, `confirmationState=proposed` through the existing PM3 candidate adapter;
- PDK4.6 performs no direct Project Memory write or confirmation.

Implementation:
- `src/projectDevelopmentKnowledge/developmentEventClustering.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4Clustering.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- correlated multi-commit implementation becomes one auditable milestone with all source provenance preserved;
- distinct semantic changes, mismatched components/domains and distant events stay split;
- cross-project and authoritative/mutated inputs fail closed;
- supporting CI evidence attaches without promoting `implemented` to `ci-verified` or later states;
- ambiguous clustering uses AI Router only and cannot self-confirm or alter authority/evidence state;
- malformed/provider-failure fallback is deterministic and replay-stable.

**Gate:** PASSED — one multi-commit implementation is represented as one coherent milestone while atomic evidence remains independently auditable and distinct changes are not collapsed by similarity alone. Full repository gate passed in SG 2.1 CI #7092 on commit `02b2d8c0cce035e6a954354814f7d5002fb4d5b4` before final documentation synchronization.

### PDK4.7 — Historical Reconstruction & Project Genesis
**Status: CLOSED / CI-verified.**

Implemented:
- deterministic rebuildable historical reconstruction over PDK4.5 atomic events plus complete PDK4.6 milestone clustering;
- `ProjectGenesis` derived view with original idea/goal where explicit origin/requirement evidence exists, earliest verified evidence, first relevant commit, initial architecture evidence, first working milestone, foundational decisions and evolution milestones;
- explicit earliest-known qualification: earliest verified evidence is not treated as the exact project creation date;
- chronological `ProductTimeline` derived from auditable PDK4.6 milestones;
- component-specific histories containing both atomic events and milestones;
- historical superseded atomic decisions remain present with lifecycle/supersession metadata rather than being deleted;
- bounded development phases reconstructed chronologically from event semantics and evidence-compatible lifecycle states;
- deterministic reconstruction fingerprint independent of input ordering;
- fail-closed checks for cross-project inputs, authoritative/mutated extraction results, unknown/duplicate cluster links and incomplete clustering;
- output remains derived-only (`trust=historical-derived`, `confirmed=false`, `authorityAllowed=false`) and does not create accepted PM3 facts.

Implementation:
- `src/projectDevelopmentKnowledge/historicalReconstruction.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4HistoricalReconstruction.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- ProjectGenesis reconstructs earliest verified evidence without inventing a project creation date;
- original idea/goal are populated only from explicit origin/requirement event evidence;
- Product Timeline remains chronological and source-auditable;
- component histories preserve superseded decisions as historical records;
- first working milestone requires implementation-compatible state plus code/test/CI/deployment/runtime evidence;
- development phases preserve historical order;
- replay with reversed input order produces the same reconstruction fingerprint and derived views;
- incomplete/cross-project/authoritative inputs fail closed;
- derived reconstruction contains no accepted/confirmed Project Memory truth.

**Gate:** PASSED — SG now has executable rebuildable ProjectGenesis/Product Timeline/Component History/development-phase reconstruction with provenance and explicit temporal qualification. Full repository gate passed in SG 2.1 CI #7100 on commit `14445ad7cfc413c241cccc759359bfb018cb2022` before final documentation synchronization.

### PDK4.8 — Temporal/Causal Linking & Reconciliation
**Status: CLOSED / CI-verified.**

Implemented:
- deterministic temporal/causal reconciliation over matching non-authoritative PDK4.5 extraction, complete PDK4.6 clustering and PDK4.7 historical reconstruction outputs;
- bounded relation graph including preserved `belongs-to-milestone` and explicit event relations plus deterministic `next-after`, `motivated-by`, `implements`, `fixes`, `verified-by-ci`, `deployed-as`, `verified-in-runtime`, `supersedes` and `superseded-by` links;
- explicit `depends-on` and other canonical relations are preserved when present in source-backed event relations; unknown targets become gaps rather than invented events;
- per-component reconciliation keeps source/roadmap-plan, code, test, CI, deployment and runtime evidence logically separate instead of flattening them into one done state;
- implementation/code without CI creates `missing-ci-evidence`; CI without deployment creates `missing-deployment-evidence`; deployment without runtime creates `missing-runtime-evidence`;
- active plans followed by delivery evidence without explicit close/supersession produce `stale-plan` gaps;
- missing/unknown supersession targets and successive active decision/plan records without explicit supersession produce `missing-supersession` gaps;
- stronger-dimension evidence that predates the latest prerequisite evidence is retained as a visible `temporal-evidence-order` contradiction;
- every `DevelopmentKnowledgeGap` is deterministic, open, derived-only and also exposed as an unverified/unconfirmed/proposed gap candidate rather than accepted Project Memory truth;
- reconciliation fingerprint is deterministic across extraction input ordering;
- cross-project, authoritative, incomplete clustering and mismatched historical reconstruction inputs fail closed;
- PDK4.8 performs no AI call, no direct Project Memory write and no trust/confirmation/authority promotion.

Implementation:
- `src/projectDevelopmentKnowledge/temporalCausalReconciliation.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4TemporalCausalReconciliation.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- implementation→CI→deployment→runtime is linked while each evidence dimension remains distinct;
- code-only state generates an explicit CI evidence gap instead of being promoted;
- stale plan and absent supersession replacement generate deterministic gaps;
- fixes correlate to prior incident/root-cause evidence inside the same bounded project/domain/component scope;
- explicit supersession links remain bidirectionally visible;
- contradictory code/CI chronology remains visible instead of being silently reordered;
- reversed extraction input ordering preserves the same reconciliation fingerprint, relations and gaps;
- cross-project, authoritative and mismatched PDK4.7 inputs fail closed;
- gap candidates remain `trust=unverified`, `confirmed=false`, `confirmationState=proposed` and cannot grant authority.

**Gate:** PASSED — `implemented`, `ci-verified`, `deployed` and `live-verified` remain distinct, temporal/causal links are auditable, and contradictions/evidence gaps remain explicit. Full repository gate passed in SG 2.1 CI #7108 on commit `4873fa255fc916cb5a6ea120e26b69870d941ee6` before final documentation synchronization.

### PDK4.9 — Continuous GitHub Ingestion
**Status: CLOSED / CI-verified.**

Implemented:
- continuous GitHub ingestion starts only after the matching PDK4.2 historical cursor is `complete`;
- the incremental cursor is anchored to the immutable SHA parsed from the PDK4.2 `lastSourceId`, preventing a null-cursor full-history rescan;
- bounded `poll`, `webhook` and internal `event` trigger contract with batch limits and bounded catch-up;
- GitHub webhook payload is trigger metadata only: repository identity is checked, but every unseen commit is independently re-verified by immutable SHA through the existing PDK4.3 source normalizer/verifier;
- durable PostgreSQL state in `pdk4_continuous_ingestion_state`, `pdk4_continuous_processed_sources` and `pdk4_continuous_triggers`;
- trigger lifecycle `processing → completed|failed`; completed/in-flight duplicates are suppressed and failed deliveries may retry safely;
- source-level idempotency prevents duplicate commit processing across retries/restart;
- PDK4.4-suppressed/non-event commits advance source bookkeeping but cannot create DevelopmentEvents or PM3 facts;
- event-eligible commits reuse PDK4.3→PDK4.4→PDK4.5 processing and are written only as unconfirmed/unverified PM3 candidates;
- optional incremental reconciliation update is required to remain non-authoritative/unconfirmed;
- authorization hook runs before GitHub fetch; observability records bounded trigger/source outcomes;
- cross-project/source mismatch, incomplete bootstrap, invalid bootstrap anchor, state-anchor loss, repository mismatch and attempted PM3/reconciliation promotion fail closed;
- migration compatibility count updated from 26 to 27 without changing existing security/runtime logic.

Implementation:
- `src/projectDevelopmentKnowledge/continuousGitHubIngestion.js`
- `src/projectDevelopmentKnowledge/postgresContinuousIngestionStore.js`
- `src/projectDevelopmentKnowledge/incrementalDevelopmentKnowledgeProcessor.js`
- `src/persistence/migrations/902_pdk4_continuous_ingestion.sql`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4ContinuousIngestion.test.js`
- `tests/postgresPersistence.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- polling starts strictly after the completed historical bootstrap SHA;
- repeated trigger/source replay does not duplicate processing;
- failed trigger can retry while completed trigger remains idempotent;
- webhook repository mismatch fails closed and webhook content never substitutes for immutable source verification;
- suppressed changes advance durable cursor without Project Memory mutation;
- incomplete/invalid historical bootstrap and denied authorization fail before GitHub fetch;
- incremental processor re-verifies commit identity and stores only unconfirmed PM3 candidates;
- PostgreSQL integration proves incremental cursor, processed-source identity and trigger lifecycle survive service restart;
- migration/security/full runtime gates remain green.

**Gate:** PASSED — new verified GitHub development commits can be processed incrementally after historical bootstrap without full-history rescan, duplicate PM3 promotion or webhook-as-truth behavior. Full repository code gate passed in SG 2.1 CI #7129 on commit `963ca2c1dec84fdff6e582e49df7b72cbb3d6500` before final documentation synchronization.

### PDK4.10 — Product Component Registry & Current Project Snapshot
**Status: CLOSED / CI-verified.**

Implemented:
- deterministic bounded Product Component Registry built only from project-scoped confirmed PM3 `project-event` facts carrying PDK4 semantics;
- unconfirmed/proposed candidates are counted for diagnostics but excluded from current-state promotion;
- superseded/archived historical evidence remains represented in component event counts but cannot populate current evidence dimensions;
- current source/code/test/CI/deployment/runtime dimensions remain separate and are never collapsed into one `done` flag;
- component entries expose current state qualification, domains, active decisions, known issues, open incidents, implementation work, next plans, dependencies, latest verified evidence, stale evidence and unresolved reconciliation gaps;
- ProjectSnapshot exposes implemented, CI-verified, deployed and live-verified component lists independently plus active decisions, issues/incidents, current work, next milestones, risks, stale evidence and unresolved gaps;
- PDK4.8 reconciliation may contribute only non-authoritative dependency/gap/contradiction visibility and cannot promote current PM3 state;
- deterministic registry and snapshot fingerprints are stable across fact/gap ordering and exclude generation time from semantic identity;
- cross-project facts, duplicate confirmed event ids, authoritative reconciliation and malformed reconciliation fail closed;
- output remains `trust=snapshot-derived`, `confirmed=false`, `authorityAllowed=false` and creates no new persistence layer.

Implementation:
- `src/projectDevelopmentKnowledge/productComponentRegistrySnapshot.js`
- `src/projectDevelopmentKnowledge/index.js`
- `tests/projectDevelopmentKnowledge4ComponentSnapshot.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- code and CI can be present while deployment/runtime remain explicitly absent;
- proposed deployment/runtime candidates cannot promote snapshot state;
- superseded historical runtime evidence cannot make the replacement component live-verified;
- decisions/incidents/current work/next plans/gaps/contradictions are exposed in separate bounded collections;
- dependency relations remain informational and non-authoritative;
- reversed fact/gap ordering preserves deterministic fingerprints;
- cross-project and authority-bearing inputs fail closed;
- empty confirmed knowledge yields an explicit unknown/empty snapshot rather than invented state.

**Gate:** PASSED — SG now has a rebuildable current project view that answers “where is the project now?” while keeping implementation, CI, deployment and runtime truth separate. Full repository code gate passed in SG 2.1 CI #7140 on commit `c70438935a8c7e764ce5c21351fac2025aac4a65` before final documentation synchronization.

### PDK4.11 — Development Query & Normal SG Answer Integration
**Status: CLOSED / CI-verified.**

Implemented:
- deterministic support for `current`, `historical`, `evolution`, `rationale`, `evidence`, `comparison`, `planning`, `incident-history` and `genesis` development query modes;
- current/evidence/planning requests reuse the standard PM3 guarded request path;
- historical/evolution/rationale/comparison/incident-history/genesis requests reuse PM3 Hybrid Retrieval and Context Guard with explicit bounded historical lifecycle/temporal qualification;
- default PM3 Context Guard remains current-only unless an authorized historical PDK4 query explicitly admits superseded/expired facts;
- only GitHub-trusted relevant development facts pass into historical answer context;
- resolved request project scope is re-authorized before historical retrieval and cross-project mismatch fails closed;
- bounded `DevelopmentQueryContext` carries only guarded Project Memory facts plus query-mode/data-policy/qualification metadata;
- normal `languageAwareConversationResponder` integrates PDK4.11 into ordinary SG `compose-answer` handling through AI Router only;
- historical/superseded facts must remain historical and cannot be promoted to current state without current evidence;
- provenance/currentness and open PM3 evidence conflicts remain visible to answer composition;
- incident-history similarity is advisory-only and cannot prove a current live root cause or override Universal Diagnostics;
- Project Memory/PDK4 content remains data-only and cannot grant identity, roles, permissions, ownership, authority, trust or confirmation;
- AI Router failure/invalid response uses a qualified deterministic Project Memory answer instead of inventing project state;
- production-like runtime exposes whether development-query integration is enabled without treating that flag as project truth.

Implementation:
- `src/projectDevelopmentKnowledge/developmentQueryIntegration.js`
- `src/projectDevelopmentKnowledge/index.js`
- `src/projectMemory/contextGuard.js`
- `src/projectMemory/aiRouterIntegration.js`
- `src/language/languageAwareConversationResponder.js`
- `src/runtime/localProductionHarness.js`
- `tests/projectDevelopmentKnowledge4DevelopmentQueryIntegration.test.js`
- `package.json` (`test:project-development-knowledge`)

Evidence:
- all nine canonical modes have deterministic test coverage;
- current queries reuse PM3 guarded integration;
- historical queries prove Hybrid Retrieval + Context Guard reuse with explicit current/superseded/expired qualification;
- cross-project historical retrieval fails closed before source lookup;
- bounded model context contains data-only PDK4 metadata and guarded PM3 facts;
- normal SG response composition carries PDK4 mode/qualification metadata through AI Router;
- AI failure falls back to qualified deterministic Project Memory output;
- incident-history output explicitly states advisory-only live-diagnosis semantics;
- full `npm run check`, runtime, worker and diagnostics gates passed.

**Gate:** PASSED — ordinary SG questions about project history/current state/evolution/rationale/evidence/comparison/planning/incidents/genesis now produce evidence-aware answers from bounded authorized PM3 context without raw repository prompt injection or authority/trust promotion. Full repository code gate passed in SG 2.1 CI #7153 on commit `a502d5b0252807747f7d4e660d1967752fcf90e5` before final documentation synchronization.

### PDK4.12 — Diagnostics, Production Bootstrap & Live Acceptance
- add bounded diagnostics for bootstrap, cursors, ingestion, timeline integrity, component registry, snapshots, conflicts and reconciliation gaps;
- run real historical bootstrap over the relevant SG repository history;
- prove PostgreSQL restart/resume;
- prove incremental post-bootstrap update;
- prove replay idempotency;
- prove normal SG answers about genesis/evolution/current state/next plan;
- fail closed when evidence/connectors/authorization are unavailable.

**Gate:** one production E2E proves `historical GitHub evidence → structured development knowledge → durable Project Memory → restart → incremental new change → normal SG answer with provenance/currentness`.

## Acceptance boundaries
PDK4 must never:
- create a parallel memory database;
- make raw chat or AI output verified truth;
- treat CI success as deployment;
- treat deployment as live verification;
- let historical/superseded facts override current truth;
- let memory grant roles, permissions, ownership or authority;
- bypass PM3 Context Guard;
- call AI providers outside AI Router;
- place raw secrets in durable knowledge, prompts or telemetry;
- claim an unavailable connector/source is live.

## Definition of DONE
PDK4 is complete only when PDK4.1–PDK4.12 are implemented, tested, CI-verified and production-accepted, and SG can continuously answer from evidence:

```text
how SG originated
why a major decision was made
what alternatives existed
what was implemented
what was later reworked or superseded
what incidents/bugs occurred and how they were fixed
what tests/CI prove a revision
what is deployed vs actually live-verified
what the current product state is
what work remains and what comes next
```

Documentation alone is not completion evidence.

## Dependencies
Uses existing:
- Memory 2.0;
- Project Memory 3.0;
- PostgreSQL persistence;
- Identity & Scope;
- AI Router;
- Owner Security;
- External Connections Registry;
- Resource Ownership & Authority;
- Workers/Automation;
- Observability;
- Universal Diagnostics surfaces where live operational evidence is required.