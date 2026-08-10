# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 PROGRAM

## Status
In progress. **PDK4.1–PDK4.5 CLOSED and CI-verified.** PDK4.6–PDK4.12 remain planned.

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
- correlate multiple commits/PRs/tests/docs belonging to one product change;
- create coherent milestone/change candidates while preserving all source references;
- prevent semantic similarity from collapsing distinct changes;
- maintain relation links between atomic evidence and milestone views.

**Gate:** one multi-commit implementation can be represented as one coherent milestone without losing source-level auditability.

### PDK4.7 — Historical Reconstruction & Project Genesis
- reconstruct earliest verified project evidence;
- build ProjectGenesis;
- build major Product Timeline;
- reconstruct component histories and development phases;
- preserve old/superseded decisions as historical truth rather than deleting them;
- do not invent an exact creation date when evidence only proves an earliest-known point.

**Gate:** SG can answer how the project originated and evolved with provenance and temporal qualification.

### PDK4.8 — Temporal/Causal Linking & Reconciliation
- link `motivated-by`, `implements`, `fixes`, `verified-by-ci`, `deployed-as`, `supersedes`, `depends-on` and other bounded development relations;
- reconcile roadmap, code, CI, deployment and runtime dimensions;
- detect missing supersession, stale plan and evidence gaps;
- create explicit DevelopmentKnowledgeGap records/candidates instead of guessing.

**Gate:** `implemented`, `ci-verified`, `deployed` and `live-verified` remain distinct and contradictions are visible.

### PDK4.9 — Continuous GitHub Ingestion
- after historical bootstrap, process only new source events from the durable cursor;
- support approved webhook/event or bounded polling/worker triggering;
- preserve External Connections Registry, Resource Authority, Owner Security, secrets and observability boundaries;
- update temporal links and Project Memory incrementally;
- remain idempotent under retries/replay.

**Gate:** new verified GitHub development changes appear in Project Memory automatically without full-history rescan.

### PDK4.10 — Product Component Registry & Current Project Snapshot
- build/rebuild bounded component registry from canonical facts;
- compute current implementation, CI, deployment and live-verification dimensions;
- expose active decisions, known issues/incidents, current work, risks, next milestones, stale evidence and unresolved gaps;
- keep snapshots rebuildable from canonical facts.

**Gate:** SG can answer “where is the project now?” without flattening unknown/deployed/live states into one `done` flag.

### PDK4.11 — Development Query & Normal SG Answer Integration
- support current, historical, evolution, rationale, evidence, comparison, planning, incident-history and genesis query modes;
- reuse PM3 hybrid retrieval and Context Guard;
- inject only bounded authorized development knowledge into AI Router;
- preserve provenance/currentness and historical qualification;
- keep incident similarity advisory-only for live diagnosis.

**Gate:** ordinary SG questions about history/current state/next plan produce correct evidence-aware answers without raw repository prompt injection.

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