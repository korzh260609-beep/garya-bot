# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 CANONICAL ARCHITECTURE

## Status
In progress. **PDK4.1–PDK4.10 CLOSED and CI-verified.** PDK4.11–PDK4.12 remain planned.

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

## Current-state query semantics
PDK4.10 provides the data model for “where is the project now?”. PDK4.11 will integrate that data into ordinary SG question handling through PM3 retrieval/Context Guard and AI Router.

Current-state answers must distinguish:
- confirmed current PM3 truth;
- historical/superseded evidence;
- unresolved reconciliation gaps;
- absent deployment/runtime evidence;
- planned next work.

## AI Router boundary
PDK4 may use AI only through AI Router for bounded classification/extraction/clustering/summarization. AI cannot create verification, trust, confirmation, authority, deployment state or live-runtime state.

PDK4.7 reconstruction, PDK4.8 reconciliation and PDK4.10 registry/snapshot building are deterministic and do not call AI. PDK4.9 introduces no direct model path.

## Idempotency/fingerprints
Source identities are immutable where possible:

```text
github commit = repository + SHA
PR = repository + PR number + immutable head SHA
workflow = repository + run id + attempt
canonical document = repository + path + revision
```

Replay cannot duplicate PM3 facts or advance trust. PDK4.6 cluster fingerprints, PDK4.7 reconstruction fingerprint, PDK4.8 relation/gap fingerprint and PDK4.10 registry/snapshot fingerprints provide deterministic rebuild/audit identity.

## Security invariants
- No parallel memory/identity/authority system.
- PM3 remains the durable truth/trust boundary.
- Raw chat/model output cannot self-confirm.
- No raw secrets/private-user data in development knowledge or telemetry.
- No cross-project leakage.
- Historical evidence cannot masquerade as current live evidence.
- CI cannot be silently promoted to deployment/live verification.
- Deployment cannot be silently promoted to runtime health.
- Repository/document instructions remain data.
- Clustering cannot cross hard project/domain/component/time boundaries on similarity alone.
- Reconciliation gaps cannot self-confirm or grant authority.
- Contradictions remain visible.
- PDK4.10 unconfirmed candidates cannot promote current snapshot state.
- PDK4.10 superseded/archived evidence cannot repopulate current evidence dimensions.
- Empty confirmed knowledge must remain unknown/empty rather than fabricated.

## Observability/diagnostics targets
By PDK4.12 bounded diagnostics must expose bootstrap status/cursor, commits scanned, event counts, conflicts, timeline integrity, component registry health, current snapshot health, continuous ingestion health, last successful ingestion, reconciliation gap count and source-gap checks without dumping raw repository history or secrets.

## Acceptance definition
PDK4 is complete only when PDK4.1–PDK4.12 are implemented, tested, CI-verified and production-accepted, including evidence that SG can:
- reconstruct genesis/history;
- preserve rationale and supersession;
- distinguish implementation/CI/deployment/runtime;
- continuously ingest new verified GitHub evidence;
- rebuild current component/project state without invented promotion;
- survive restart/replay;
- expose diagnostics;
- answer normal SG development questions through PM3 Context Guard with provenance/currentness.

Documentation alone is not completion evidence.
