# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 PROGRAM

## Status
In progress. **PDK4.1 CLOSED and CI-verified.** PDK4.2–PDK4.12 remain planned.

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
- scan the full relevant repository history from earliest verifiable evidence;
- process bounded commit/history batches;
- persist repository/source cursor and checkpoints in PostgreSQL;
- resume after restart;
- guarantee replay idempotency;
- separate processed-source bookkeeping from accepted project facts.

**Gate:** historical scan resumes after restart without duplicate accepted events or skipped source ranges.

### PDK4.3 — Source Normalization & Verification
- normalize GitHub commits, diffs, PRs, CI/workflow evidence and canonical repository documents into bounded source events;
- verify immutable GitHub identities/revisions;
- distinguish code evidence, CI evidence, deployment evidence and runtime evidence;
- keep unsupported connectors unavailable rather than simulated.

**Gate:** every normalized event has verifiable provenance and deterministic source identity; weak/unknown sources fail closed.

### PDK4.4 — Development Significance Classifier
- deterministic metadata/path/diff prefilter first;
- classify architecture, behavior, feature, memory, identity, security, integration, persistence, infrastructure, roadmap, incident/fix and other meaningful changes;
- suppress formatting/generated/trivial churn from durable development knowledge;
- use AI Router only for bounded ambiguous/significant classification.

**Gate:** trivial changes do not pollute Project Memory; significant architecture/product changes are retained with evidence.

### PDK4.5 — Development Event Extraction
- extract problem, intent, proposal, decision, rationale, alternatives, implementation, result, limitation and lifecycle transition from already-authorized evidence;
- preserve source provenance for every extracted field/claim;
- route model assistance only through AI Router;
- emit PM3 candidates rather than direct durable truth.

**Gate:** model output cannot self-confirm or mutate durable Project Memory; extracted events remain bounded and provenance-backed.

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
