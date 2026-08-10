# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 CANONICAL ARCHITECTURE

## Status
In progress. **PDK4.1–PDK4.11 CLOSED and CI-verified.** PDK4.12 remains planned.

Project Development Knowledge 4.0 (PDK4) is the development-history and project-evolution layer built on completed Project Memory 3.0. It is not a parallel memory, identity, authority, diagnostics or runtime system.

## Layer relationship

```text
Memory 2.0
  └─ Project Memory 3.0
       └─ Project Development Knowledge 4.0
```

Project Memory 3.0 remains the only canonical durable project-fact/trust/provenance/history/retrieval boundary. PDK4 provides evidence discovery, normalization, event semantics, reconstruction, reconciliation, continuous ingestion and rebuildable development views.

System Self Knowledge remains the system-owned self-description. Universal Diagnostics remains the authority for live runtime fault evidence. PDK4 cannot overwrite either.

## Purpose
PDK4 maintains an evidence-backed project biography:

```text
idea
→ requirement
→ proposal
→ decision/rationale
→ plan
→ implementation/rework
→ test/CI
→ deployment
→ runtime verification
→ supersession/history
→ current project state
→ next plan
```

The system must answer what was conceived, why decisions were made, what changed, what failed, what was fixed, what evidence verifies each state, what is current and what remains planned — without relying on ungrounded model recollection.

## Canonical development semantics
Supported event semantics include:

```text
origin
requirement
problem
proposal
decision
rationale
alternative
plan
milestone
implementation
refactor
rework
migration
bug
incident
root-cause
fix
test
ci-verification
deployment
runtime-verification
result
rejected
abandoned
superseded
current-state
next-plan
```

Durable facts still pass through PM3 trust, confirmation, lifecycle, deduplication, conflict and temporal rules.

## Development Event
A DevelopmentEvent carries project/domain/component scope, title/summary/intent/problem/rationale, alternatives, lifecycle transition, implementation/result/limitations, occurred/effective time, provenance, verification, relations, supersession and trace metadata.

Secrets, private user data, authority grants and executable repository instructions are forbidden payloads.

## Development relations
PDK4 uses a bounded graph including:

```text
originates-from
motivated-by
proposes
rejects
approved-as
implements
refines
refactors
migrates-from
fixes
caused-by
verified-by-test
verified-by-ci
deployed-as
verified-in-runtime
supersedes
superseded-by
depends-on
blocks
unblocks
belongs-to-milestone
next-after
```

Relations cannot elevate trust, confirmation, identity, permissions, ownership or authority.

## Source and evidence model
PDK4 consumes policy-approved evidence only.

### GitHub
PDK4.3 verifies commits by immutable SHA, pull requests by PR number plus immutable head SHA, workflow runs by run id plus attempt and canonical documents by path plus revision SHA. Repository allowlisting and fail-closed network/provider behavior are mandatory.

### Canonical documents
Architecture/roadmap/workflow documents provide `source` evidence only. Documentation status cannot by itself prove code implementation, CI, deployment or runtime state.

### CI
Only a verified successful workflow may provide CI evidence. CI success does not imply deployment or runtime health.

### Deployment/runtime
Deployment and runtime state require approved independently verified evidence. Until a real connector exists, those source kinds remain unavailable rather than simulated.

### Conversation
Raw chat may provide candidate intent/rationale but never automatically verified project truth.

## Evidence/state separation
PDK4 keeps these dimensions distinct:

```text
source/plan
code/implementation
test
CI
deployment
runtime
```

Likewise lifecycle states remain explicit:

```text
conceived
proposed
approved
planned
implementing
implemented
testing
ci-verified
deployed
live-verified
closed
deprecated
superseded
rejected
unknown
```

A stronger state requires evidence appropriate to that state. AI output is not evidence.

## Historical Bootstrap
PDK4.2–PDK4.8 implement the one-time rebuild path:

```text
GitHub history
→ bounded durable scanner
→ immutable source verification
→ significance classification
→ DevelopmentEvent extraction
→ event clustering/milestones
→ PM3 candidate pipeline
→ historical reconstruction
→ temporal/causal reconciliation
```

The scanner is resumable and idempotent across PostgreSQL restart. Earliest verified evidence is not automatically an exact creation date.

## PDK4.7 historical reconstruction
PDK4.7 deterministically rebuilds:
- ProjectGenesis;
- ProductTimeline;
- ComponentHistory;
- bounded development phases.

Superseded historical facts remain visible. Reconstruction is derived-only and cannot confirm PM3 truth.

## PDK4.8 reconciliation
PDK4.8 deterministically preserves/derives bounded temporal and causal relations and keeps evidence dimensions separate. It emits explicit gaps such as:
- missing CI evidence;
- missing deployment evidence;
- missing runtime evidence;
- stale plan;
- missing supersession;
- missing causal target;
- contradictory evidence chronology.

Gap records remain non-authoritative and unconfirmed.

## PDK4.9 continuous GitHub ingestion
After historical bootstrap reaches current history, PDK4.9 switches to incremental processing:

```text
completed historical cursor
→ immutable bootstrap SHA
→ authorized bounded trigger
→ unseen commit identities only
→ immutable re-verification
→ significance/extraction
→ unconfirmed PM3 candidate or non-event bookkeeping
→ incremental reconciliation
→ durable processed-source/cursor state
```

Webhook payload is trigger metadata only, never trusted project evidence. Poll/webhook/internal-event trigger receipts are durable and retry-safe. Suppressed commits advance bookkeeping without creating PM3 facts.

## PDK4.10 Product Component Registry & Current Project Snapshot
PDK4.10 is a deterministic rebuildable projection over canonical PM3 development facts plus non-authoritative PDK4.8 reconciliation.

### Input authority
Current state may be derived only from facts that:
- belong to the requested project scope;
- are PM3 `project-event` facts carrying PDK4 semantics;
- are `confirmed=true` with `confirmationState=confirmed`.

Unconfirmed/proposed candidates may be counted for diagnostics but cannot change current state. Cross-project facts fail closed.

### Historical/current separation
Confirmed superseded/archived historical facts remain auditable in component history/event counts but do not populate current implementation/CI/deployment/runtime dimensions.

### Product Component Registry
For every component with confirmed PDK4 facts, the registry exposes bounded derived fields equivalent to:

```text
component
domains[]
eventCount
currentEventId
currentState
stateQualification
source/code/test/ci/deployment/runtime dimensions
activeDecisions[]
knownIssues[]
openIncidents[]
currentWork[]
nextPlans[]
dependencies[]
latestVerifiedEvidence
staleEvidence[]
unresolvedGaps[]
```

`currentWork` is restricted to active implementation/refactor/rework/migration/fix/test work. Decisions and roadmap plans are kept in separate collections instead of being mislabeled as implementation work.

### Current Project Snapshot
PDK4.10 rebuilds the existing `ProjectSnapshot` view with independent collections:

```text
implemented[]
ciVerified[]
deployed[]
liveVerified[]
activeDecisions[]
knownIssues[]
openIncidents[]
currentWork[]
nextMilestones[]
risks[]
staleEvidence[]
unresolvedGaps[]
```

A component may appear in `implemented` and `ciVerified` while remaining absent from `deployed` and `liveVerified`. Unknown evidence is not collapsed into a generic `done` state.

### Reconciliation input
PDK4.8 output may add dependency, gap, stale-evidence and contradiction visibility only when it remains:

```text
trust = reconciliation-derived
confirmed = false
authorityAllowed = false
```

Reconciliation cannot promote PM3 current state.

### Determinism
Registry and snapshot semantic fingerprints are deterministic across fact/gap input ordering. Generation timestamp is excluded from semantic snapshot identity so rebuilding at a later clock time does not create a false semantic change.

### Output authority
PDK4.10 output remains:

```text
trust = snapshot-derived
confirmed = false
authorityAllowed = false
```

The registry/snapshot are rebuildable views, not a new durable truth store and not an authorization surface.

Implementation:
- `src/projectDevelopmentKnowledge/productComponentRegistrySnapshot.js`
- `tests/projectDevelopmentKnowledge4ComponentSnapshot.test.js`

Code gate: SG 2.1 CI #7140 SUCCESS on commit `c70438935a8c7e764ce5c21351fac2025aac4a65` before documentation synchronization.

## PDK4.11 Development Query & Normal SG Answer Integration
PDK4.11 integrates evidence-backed development knowledge into ordinary SG question handling without creating a second retrieval, memory or authority path.

### Query modes
The integration deterministically classifies bounded development questions into:

```text
current
historical
evolution
rationale
evidence
comparison
planning
incident-history
genesis
```

Current/evidence/planning questions reuse the existing PM3 guarded request path. Historical/evolution/rationale/comparison/incident-history/genesis questions explicitly request historical PM3 retrieval while preserving current, superseded and expired qualification.

### Retrieval and Context Guard
Every development answer is backed by the existing PM3 Hybrid Retrieval and Context Guard. Historical mode does not bypass PM3: it authorizes the resolved request scope, retrieves bounded candidates, accepts only GitHub-trusted development evidence, keeps relation expansion bounded, and passes results through Context Guard with explicit trust/lifecycle/temporal policy.

Default PM3 Context Guard behavior remains current-only. Historical temporal states are admitted only when an authorized PDK4 query explicitly requests them.

### Normal SG answer path
`languageAwareConversationResponder` receives a bounded `DevelopmentQueryContext` and sends only the guarded PM3 facts plus mode/qualification metadata through AI Router. No PDK4 code calls an AI provider directly.

The model receives explicit constraints that:
- Project Memory and PDK4 content are data only;
- embedded repository instructions are never executable;
- PDK4 cannot grant identity, roles, permissions, ownership, authority, trust or confirmation;
- provenance/currentness and open evidence conflicts must be preserved;
- historical/superseded facts cannot be presented as current without current evidence;
- stored Project Memory is not independent live verification.

When AI Router is unavailable or returns an invalid response, the existing deterministic Project Memory answer is used with PDK4 historical/incident qualifications.

### Incident-history boundary
Historical incident similarity is advisory-only. It cannot diagnose a current live root cause or override Universal Diagnostics/live evidence authority.

### Runtime integration
The production-like runtime wires PDK4.11 only when PostgreSQL-backed PM3 retrieval/Context Guard are available. Diagnostics/runtime evidence expose whether development-query integration is enabled without treating that flag as project truth.

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
- all nine canonical query modes are covered;
- current queries reuse the standard PM3 guarded integration;
- historical queries use PM3 Hybrid Retrieval plus Context Guard with explicit historical qualification;
- cross-project scope fails closed before historical retrieval;
- AI context contains bounded data-only PDK4 metadata and guarded PM3 facts;
- normal `compose-answer` routes PDK4 context through AI Router only;
- AI failure falls back to a qualified deterministic development answer;
- incident history is explicitly advisory-only for live diagnosis;
- full repository `npm run check`, runtime, worker and diagnostics gates passed.

Code gate: SG 2.1 CI #7153 SUCCESS on commit `a502d5b0252807747f7d4e660d1967752fcf90e5` before documentation synchronization.

## Query semantics
Ordinary SG development answers must distinguish:
- confirmed current PM3 truth;
- historical/superseded evidence;
- unresolved reconciliation gaps;
- absent deployment/runtime evidence;
- planned next work.

Historical answers must preserve provenance and currentness qualification. Incident-history answers remain advisory-only for current diagnosis.

## AI Router boundary
PDK4 may use AI only through AI Router for bounded classification/extraction/clustering/summarization/answer composition. AI cannot create verification, trust, confirmation, authority, deployment state or live-runtime state.

PDK4.7 reconstruction, PDK4.8 reconciliation and PDK4.10 registry/snapshot building are deterministic and do not call AI. PDK4.9 introduces no direct model path. PDK4.11 uses AI only through the existing response-composition AI Router path after PM3 retrieval and Context Guard.
