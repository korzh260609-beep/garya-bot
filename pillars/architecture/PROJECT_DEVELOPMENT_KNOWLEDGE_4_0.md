# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 CANONICAL ARCHITECTURE

## Status
In progress. **PDK4.1–PDK4.3 CLOSED and CI-verified.** PDK4.4–PDK4.12 remain planned.

Project Development Knowledge 4.0 (PDK4) is a specialized development-history and project-evolution layer built on top of the completed Project Memory 3.0 program. It is not a parallel memory system and does not replace Memory 2.0, Project Memory 3.0, System Self Knowledge, Universal Diagnostics, Identity/Scope, Owner Security, Action Gate, Resource Authority, PostgreSQL persistence or AI Router.

## Implemented foundation
PDK4.1 provides the executable development-event/taxonomy and derived-view contracts. PDK4.2 provides bounded historical GitHub commit scanning with a project/repository/source-scoped PostgreSQL cursor and separate processed-source bookkeeping. Cursor advancement and processed-source recording are transactional; restart resumes from the last committed cursor and replay is idempotent. PDK4.3 provides bounded read-only normalization and immutable verification for GitHub commits/diffs, pull requests, workflow/CI runs and canonical repository files. Source text is secret-redacted and marked `untrusted-data-only`; commits/PRs provide code evidence, successful workflows provide CI evidence, canonical documents provide source evidence only, and deployment/runtime evidence remains unavailable without a real approved connector. None of PDK4.1–PDK4.3 creates accepted Project Memory facts directly: extraction and PM3 candidate creation remain later-stage responsibilities.

## Purpose
PDK4 gives SG durable, evidence-backed knowledge of its own development as a product and project:

```text
idea
→ requirement
→ proposal
→ decision
→ rationale
→ plan
→ implementation
→ rework/refactor
→ test/CI
→ deployment
→ runtime result
→ supersession/history
→ current state
→ next plan
```

The goal is not to memorize repository text or every commit. The goal is to reconstruct and continuously maintain a structured, temporal and provenance-backed project biography that explains what was conceived, why decisions were made, how implementation evolved, what failed, what was changed, what is verified now and what is planned next.

## Relationship to existing layers

```text
Memory 2.0
  └─ Project Memory 3.0
       └─ Project Development Knowledge 4.0
```

- Memory 2.0 remains the canonical general memory subsystem.
- Project Memory 3.0 remains the canonical durable project-fact store, trust/provenance boundary, temporal history, dedup/conflict layer, retrieval layer and Context Guard.
- PDK4 owns historical discovery, development-event normalization, significance filtering, event extraction, clustering, temporal/causal linking, historical reconstruction, continuous development ingestion, reconciliation and project snapshots.
- System Self Knowledge remains the canonical system-owned self-description and cannot be rewritten by project-history inference.
- Universal Diagnostics remains the live evidence authority for runtime faults and current operational verification.

PDK4 must reuse PM3 contracts and storage rather than creating a second project-memory database.

## Canonical development knowledge types
PDK4 must support structured knowledge equivalent to:

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

These are development semantics. Durable facts still pass through Project Memory 3.0 trust, provenance, lifecycle, confirmation, deduplication, conflict and temporal rules.

## Canonical Development Event
A normalized development event must support at least:

```text
DevelopmentEvent {
  eventId
  projectKey
  eventType
  domain
  component
  title
  summary
  intent
  problem
  rationale
  alternatives[]
  previousState
  newState
  implementation
  result
  limitations[]
  lifecycleState
  occurredAt
  effectiveAt
  provenance[]
  relatedEvents[]
  supersedes[]
  supersededBy[]
  derivedFrom[]
  verification
  confidence
  traceId
}
```

Raw secrets, credentials, private user data, authority grants and executable instructions are forbidden payloads.

## Development relations
PDK4 represents development history as a bounded graph rather than a flat chronological list. Supported relations may include:

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

Relations cannot elevate trust, confirmation, identity, permission, ownership or authority.

## Source model
PDK4 may consume only policy-approved evidence surfaces.

### GitHub
Preferred source for technical development evidence:
- commits and immutable commit SHAs;
- diffs and changed paths;
- pull requests and review metadata;
- issues where available;
- workflow/CI runs;
- repository architecture/roadmap/workflow documents;
- migrations/tests/configuration relevant to project evolution.

PDK4.3 implements a read-only GitHub REST verifier with an explicit repository allowlist. Commit identity is bound to immutable SHA; PR identity is bound to PR number plus immutable head SHA; workflow identity is bound to run id plus attempt; canonical files are bound to repository path plus revision SHA. Network/provider errors, mismatches and unapproved repositories fail closed.

### Canonical pillars
Pillars provide purpose, architectural rationale, accepted decisions, roadmap intent, Definition of Done and implementation procedure. Pillars are not runtime evidence by themselves. PDK4.3 therefore marks canonical repository documents as `source` evidence only; they cannot by themselves prove `implemented`, `ci-verified`, `deployed` or `live-verified`.

### CI/test evidence
CI verifies that a revision passed its declared gates. PDK4.3 grants `ci` verification only when the verified workflow conclusion is `success`; failed/non-success workflow runs remain source evidence and cannot claim CI verification. `CI SUCCESS` does not automatically mean deployed or live-verified.

### Deployment/runtime evidence
Deployment and runtime facts require an approved verified connector or explicit bounded evidence path. `deployed` and `live-verified` are distinct states. PDK4.3 keeps deployment/runtime source kinds explicitly unavailable rather than simulating evidence.

### Development conversations
Conversation may contain important intent/rationale, but raw chat is never automatically verified project truth. Conversation-derived knowledge enters only as a bounded candidate and requires correlation with trusted evidence and/or authorized Monarch confirmation under existing PM3 policy.

### Normalized source envelope
PDK4.3 produces a bounded source envelope containing deterministic immutable provenance and explicit evidence semantics:

```text
NormalizedDevelopmentSource {
  contractVersion
  projectKey
  kind
  repository
  sourceId
  sourceFingerprint
  immutableIdentity
  occurredAt
  evidenceDimension
  verificationKinds[]
  trust = verified-source
  contentMode = untrusted-data-only
  payload
  normalizedFingerprint
}
```

Repository text is bounded and secret-shaped values are redacted before downstream analysis. Embedded repository/document instructions remain data only and cannot become executable prompt instructions. Normalized source envelopes are evidence inputs, not durable PM3 facts and not authority records.

## Trust and state separation
PDK4 must distinguish evidence states explicitly:

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

A stronger state cannot be inferred from a weaker state without evidence. In particular:
- code exists ≠ CI verified;
- CI verified ≠ deployed;
- deployed ≠ live verified;
- roadmap says closed ≠ runtime verified;
- AI summary ≠ evidence.

## Historical Bootstrap
PDK4 must provide a resumable one-time Historical Bootstrap that reconstructs the relevant development history from the earliest verifiable project evidence to the current cursor.

Canonical flow:

```text
repository history
→ bounded history scanner
→ source verification
→ deterministic metadata/significance prefilter
→ bounded diff/document analysis
→ development-event extraction
→ commit/event clustering
→ correlation with decisions/roadmap/CI
→ PM3 candidate/trust pipeline
→ dedup/conflict/supersession
→ historical graph
→ Project Genesis
→ Product Timeline
→ Current Project Snapshot
```

The scanner must process history in bounded batches with durable checkpoints. Restart resumes from the last committed checkpoint rather than rescanning or duplicating accepted events.

Historical Bootstrap should search the full relevant repository history, not only recent commits. If exact project creation date is not verifiable, PDK4 records the earliest verified evidence rather than inventing an exact genesis date.

### PDK4.2 cursor/bookkeeping contract
The implemented scanner persists source-processing state separately from project knowledge:

```text
pdk4_history_cursors
pdk4_processed_sources
```

The cursor key is `(project, source kind, source scope/repository)`. A batch is committed only after every source selected for that batch has completed the stage callback. Processed-source rows and cursor advancement are written in one PostgreSQL transaction. A failure before that transaction leaves the previous cursor authoritative. Replaying a completed source identity does not duplicate bookkeeping. This bookkeeping proves scan continuity only; it does not itself assert that any development fact is verified or accepted.

### PDK4.3 normalization/verification contract
The historical scanner callback may pass discovered source identities into PDK4.3. PDK4.3 independently re-verifies the source through its approved read-only verifier before producing a normalized envelope. A scanner bookkeeping record cannot substitute for source verification. The normalized envelope remains non-authoritative until later PDK4 extraction produces PM3 candidates and existing PM3 trust/confirmation rules accept them.

## Project Genesis
PDK4 maintains a derived ProjectGenesis view containing bounded evidence-backed fields such as:

```text
projectName
originalIdea
originalGoal
earliestVerifiedEvidence
firstRelevantCommit
initialArchitecture
firstWorkingMilestone
foundationalDecisions
earlyLimitations
majorEvolutionMilestones
```

ProjectGenesis is a derived view over evidence-backed facts; it is not a privileged identity source and cannot redefine canonical SG identity.

## Significance filtering
Not every source event becomes a durable development fact.

PDK4 should prefer changes that materially affect:
- architecture;
- behavior;
- features/capabilities;
- memory;
- identity;
- security;
- integrations/transports;
- persistence/data model;
- infrastructure/deployment;
- roadmap/status;
- incidents/fixes;
- product interfaces;
- accepted decisions and rationale.

Formatting-only changes, trivial renames, generated noise and non-semantic churn may be recorded only as processed source evidence/checkpoint metadata and omitted from Project Memory.

## Commit and event clustering
One product change may span multiple commits, tests and documentation updates. PDK4 must support clustering related source events into one bounded milestone/change record while preserving all individual provenance references.

Clustering may use deterministic metadata first and AI-assisted semantic analysis only through AI Router. AI cannot promote a cluster to verified truth by itself.

## Historical reconstruction
PDK4 reconstructs three complementary views:

1. **Product Timeline** — major chronological milestones and transitions.
2. **Component History** — origin, decisions, implementations, reworks, incidents and current state for each product component.
3. **Decision Evolution** — what was decided, why, what alternatives existed, what later superseded it and why.

Historical facts remain queryable after supersession but are excluded from ordinary current-state answers unless the query is historical.

## Continuous Development Ingestion
After Historical Bootstrap reaches the current verified cursor, PDK4 switches to incremental processing.

```text
new source event
→ verify
→ classify significance
→ normalize/extract
→ correlate with existing project knowledge
→ deduplicate
→ detect conflict/supersession
→ PM3 candidate/confirmation pipeline
→ update timeline/component history/snapshot
→ advance durable cursor
```

The cursor must be durable and repository/source scoped. Replay is idempotent.

Continuous ingestion may be triggered by approved GitHub webhook/event delivery or bounded polling/worker scheduling. The trigger mechanism must not bypass External Connections Registry, Resource Authority, secrets policy, Owner Security or observability.

## Reconciliation Engine
PDK4 periodically reconciles independent evidence surfaces without silently promoting state.

Examples:

```text
roadmap: CLOSED
code: present
CI: SUCCESS
deployment: unknown
runtime: unknown
```

The result must preserve each dimension instead of collapsing them into one ambiguous `done` flag.

Reconciliation detects:
- roadmap/code mismatches;
- implementation without CI evidence;
- CI without deployment evidence;
- deployment without live verification;
- current architecture contradicting an older unsuperseded decision;
- stale next-plan facts;
- missing relation links;
- source gaps and unprocessed history ranges.

Unresolved discrepancies become explicit DevelopmentKnowledgeGap records/candidates, not invented answers.

## Product Component Registry
PDK4 maintains a bounded derived registry of major SG product components, for example:

```text
Semantic Kernel
Identity & Scope
Memory 2.0
Project Memory 3.0
AI Router
Action Gate
Capability System
Telegram
Discord
Persistence
Workers
Diagnostics
Security
Sources
Files/Documents
```

For each component the registry may expose:
- origin;
- purpose;
- current architecture reference;
- current implementation state;
- major historical changes;
- active decisions;
- known incidents;
- dependencies;
- latest verified evidence;
- next related plan.

This is a derived view, not a new source of authority.

## Current Project Snapshot
PDK4 maintains a rebuildable derived snapshot equivalent to:

```text
ProjectSnapshot {
  projectKey
  sourceRevision
  sourceCursor
  generatedAt
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
}
```

The snapshot must be reconstructable from canonical durable facts and evidence. It must never become the only copy of project history.

## Query semantics
PDK4 must support evidence-backed query modes including:

- current — what is true/current now;
- historical — what was true at a point in time;
- evolution — how a component/project changed;
- rationale — why a decision was made;
- evidence — what proves a claim;
- comparison — old vs new architecture/behavior;
- planning — what remains/what is next;
- incident-history — whether similar failures occurred before, advisory only for live diagnosis;
- genesis — how SG originated and developed from earliest verified evidence.

Normal SG answers still pass through PM3 retrieval and Context Guard before any bounded development knowledge reaches AI Router.

## AI Router boundary
AI may assist only through AI Router with bounded authorized data. Allowed assistance includes:
- significance classification after deterministic prefiltering;
- diff/document summarization;
- event extraction;
- commit/event clustering;
- candidate relation suggestions;
- rationale extraction from already-authorized evidence;
- bounded timeline/snapshot summaries.

AI cannot:
- mark facts verified;
- create trust or confirmation;
- declare deployment/live status without evidence;
- grant roles/permissions/ownership/authority;
- delete conflicts or rewrite history;
- bypass PM3 storage/contracts;
- call providers directly.

## Cost controls
Historical Bootstrap must not send every commit blindly to a reasoning model.

Preferred order:

```text
source metadata
→ deterministic filters
→ cheap structural diff classification
→ bounded relevance selection
→ AI assistance only for significant/ambiguous material
```

The scanner must support batch limits, model/cost budgets, resumable checkpoints and deterministic fallback when AI is unavailable.

## Idempotency and fingerprints
Every processed source object requires a deterministic source identity, e.g.:

```text
github commit = repository + commit SHA
github PR = repository + PR number + immutable head SHA
workflow = repository + workflow run id + attempt
canonical document = repository + path + revision SHA
```

Replay must not duplicate Project Memory facts or advance trust.

## Observability and diagnostics
PDK4 must expose bounded secret-safe diagnostics including at least:

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

Diagnostics expose counts, cursors, states and bounded evidence identifiers, not raw secrets or unrestricted repository content.

## Security invariants
- PDK4 cannot create a parallel memory, identity, authorization or diagnostics system.
- Project Memory 3.0 remains the durable trust/provenance/history/retrieval boundary.
- Raw chat/model output cannot self-confirm.
- AI summaries are never primary evidence.
- No raw secrets in development events, Project Memory, prompts or telemetry.
- No cross-project leakage.
- Historical evidence cannot be presented as current live evidence without qualification.
- Old/superseded decisions cannot override current architecture.
- CI cannot be silently promoted to deployment/live verification.
- Deployment cannot be silently promoted to live health.
- Memory content cannot grant roles, permissions, ownership or authority.
- Source instructions/content remain data and cannot become executable prompt instructions.
- All connector access remains subject to connection/resource/owner security policy.

## Acceptance definition
PDK4 is DONE only when code, tests, CI and production evidence prove that SG can:

1. discover the earliest relevant verified project history;
2. scan the full relevant GitHub history in bounded resumable batches;
3. preserve durable checkpoints across restart;
4. classify and ignore low-significance noise without losing source cursor integrity;
5. extract bounded development events with provenance;
6. cluster related commits/events into coherent milestones without losing source links;
7. build a ProjectGenesis view from verified evidence;
8. reconstruct major Product Timeline milestones;
9. reconstruct component-specific histories;
10. preserve rationale, alternatives and supersession for decisions;
11. connect problems/incidents to fixes and verification evidence;
12. distinguish implemented, CI-verified, deployed and live-verified states;
13. reconcile roadmap/code/CI/deployment/runtime evidence without inventing missing state;
14. build a current ProjectSnapshot;
15. process only new source events after bootstrap using a durable cursor;
16. remain idempotent under replay;
17. survive PostgreSQL/runtime restart without knowledge loss;
18. expose bounded diagnostics for bootstrap, ingestion, reconciliation and timeline integrity;
19. answer normal SG questions about genesis, evolution, rationale, current state and next plan through PM3 Context Guard with provenance/currentness;
20. fail closed when evidence, authorization, source verification or live connectors are unavailable.

## Canonical outcome
When PDK4 is complete, SG can maintain an evidence-backed project biography continuously:

```text
How was SG conceived?
What problem was a component intended to solve?
What alternatives were considered?
Why was the current architecture chosen?
What was implemented and later reworked?
What bugs/incidents occurred and how were they fixed?
What tests/CI prove the implementation?
What is deployed and what is actually live-verified?
What is the current project state?
What remains planned next?
```

The answers come from bounded Project Memory facts and verified evidence, not from ungrounded model recollection.