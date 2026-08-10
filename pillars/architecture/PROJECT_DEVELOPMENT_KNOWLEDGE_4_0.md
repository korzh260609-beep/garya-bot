# SG 2.1 — PROJECT DEVELOPMENT KNOWLEDGE 4.0 CANONICAL ARCHITECTURE

## Status
In progress. **PDK4.1–PDK4.9 CLOSED and CI-verified.** PDK4.10–PDK4.12 remain planned.

Project Development Knowledge 4.0 (PDK4) is a specialized development-history and project-evolution layer built on top of the completed Project Memory 3.0 program. It is not a parallel memory system and does not replace Memory 2.0, Project Memory 3.0, System Self Knowledge, Universal Diagnostics, Identity/Scope, Owner Security, Action Gate, Resource Authority, PostgreSQL persistence or AI Router.

## Implemented foundation
PDK4.1 provides the executable development-event/taxonomy and derived-view contracts. PDK4.2 provides bounded historical GitHub commit scanning with a project/repository/source-scoped PostgreSQL cursor and separate processed-source bookkeeping. Cursor advancement and processed-source recording are transactional; restart resumes from the last committed cursor and replay is idempotent. PDK4.3 provides bounded read-only normalization and immutable verification for GitHub commits/diffs, pull requests, workflow/CI runs and canonical repository files. Source text is secret-redacted and marked `untrusted-data-only`; commits/PRs provide code evidence, successful workflows provide CI evidence, canonical documents provide source evidence only, and deployment/runtime evidence remains unavailable without a real approved connector. PDK4.4 provides deterministic significance filtering over those verified normalized envelopes, suppresses generated/formatting/trivial churn, retains material development evidence, treats workflow runs as supporting evidence rather than standalone product changes, and uses bounded AI Router assistance only for ambiguous classification. PDK4.5 converts only event-eligible verified evidence into bounded provenance-backed DevelopmentEvents and unverified/proposed PM3 candidates; model assistance is Router-only and cannot promote evidence state, confirm facts, write Project Memory or grant authority. PDK4.6 deterministically clusters compatible extracted events into bounded milestone candidates while preserving every atomic event and provenance source, keeps hard project/domain/component/time separation, attaches explicit supporting evidence only through known atomic-event links, and permits Router assistance only for ambiguous merge/split decisions. PDK4.7 deterministically rebuilds ProjectGenesis, ProductTimeline, ComponentHistory views and development phases from complete PDK4.5/PDK4.6 evidence, preserves superseded historical truth, and explicitly distinguishes earliest verified evidence from an exact project creation date. PDK4.8 deterministically links bounded temporal/causal relations and reconciles source/roadmap-plan, code, test/CI, deployment and runtime evidence while preserving state separation and emitting explicit non-authoritative knowledge gaps for missing or contradictory evidence. PDK4.9 adds durable incremental GitHub ingestion after completed historical bootstrap, anchors the incremental cursor to the last immutable historical commit SHA, treats webhook/event delivery as trigger-only, re-verifies unseen commits through the existing source boundary, keeps retry/replay idempotent across PostgreSQL restart and prevents suppressed changes or model output from becoming confirmed Project Memory truth. None of PDK4.1–PDK4.9 creates accepted Project Memory facts directly.

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

### PDK4.4 significance-classification contract
PDK4.4 accepts only PDK4.3 envelopes that remain `verified-source` and `untrusted-data-only`. It performs deterministic metadata/path/diff classification before any model assistance and emits a non-authoritative classification result tied to the normalized source fingerprint.

Canonical significance outcomes are:

```text
suppressed
supporting-evidence
significant
ambiguous
```

Canonical material categories are bounded to architecture, behavior, feature, memory, identity, security, integration, persistence, infrastructure, roadmap, incident/fix and other meaningful changes. Generated-only, whitespace-only and explicit formatting/lint/typo churn may be suppressed before event extraction. Verified workflow runs remain supporting evidence for correlation and cannot independently become a product-change event. Canonical architecture/roadmap/workflow documents may be significant inputs while retaining their existing `source` evidence semantics.

Only an ambiguous deterministic result may invoke AI Router. The Router receives bounded repository material marked data-only and may only assist the significance/category decision. Model output cannot create trust, confirmation, implementation/CI/deployment/runtime state, identity, roles, permissions, ownership or authority. Router failure or malformed output falls back deterministically without dropping the ambiguous source. Classification fingerprints are deterministic for audit/replay consistency. The classifier has no direct Project Memory write or confirmation path.

### PDK4.5 development-event extraction contract
PDK4.5 accepts only an event-eligible PDK4.4 classification that exactly matches the verified PDK4.3 source id and normalized fingerprint. Suppressed or supporting-evidence-only results cannot independently become DevelopmentEvents.

The extractor establishes deterministic baseline semantics first: event type, Project Memory domain, component, title/summary and an evidence-compatible lifecycle transition. It may then use AI Router to extract bounded semantic fields such as intent, problem, rationale, alternatives, implementation, result and limitations from the same already-authorized evidence. Model output remains data, is bounded/redacted, cannot alter the source evidence dimension, cannot claim deployment/live verification without those evidence kinds, and cannot confirm a fact.

Every extracted event preserves the immutable source identity in provenance, the source id in `derivedFrom`, and verification records derived only from PDK4.3 evidence. Replay yields deterministic semantic/extraction fingerprints for the same normalized source/classification. The only Project Memory output is a PM3 `project-event` candidate forced to `trust=unverified`, `confirmed=false` and `confirmationState=proposed`. PDK4.5 has no direct durable store mutation or authority path.

### PDK4.6 clustering/milestone contract
PDK4.6 accepts only non-authoritative PDK4.5 extraction results whose PM3 candidates remain `unverified`, unconfirmed and proposed. It never treats a milestone as a replacement for its atomic events.

Deterministic clustering is bounded by project, domain, normalized component, temporal gap and semantic anchors. Project/domain/component/time incompatibility is a hard split. Strong compatible similarity may merge deterministically; only a bounded ambiguous compatible pair may invoke AI Router. Router output is restricted to merge/split assistance and cannot alter evidence, lifecycle state, trust, confirmation, identity, ownership, permissions or authority.

Each cluster emits a milestone `DevelopmentEvent` candidate with deterministic cluster fingerprints, all unique atomic provenance references and source-level verification copied only from the clustered atomic events. Each atomic event receives a derived `belongs-to-milestone` relation-link record. PDK4.4 `supporting-evidence` sources such as successful workflows may attach only through explicit links to known atomic event ids. Supporting evidence is retained for correlation/audit but is not copied into the milestone verification set and therefore cannot independently promote `implemented` to `ci-verified`, `deployed` or `live-verified`.

Malformed/unavailable AI assistance fails deterministically to split. PDK4.6 has no direct durable Project Memory mutation or self-confirmation path; its milestone candidate remains subject to the existing PM3 trust/confirmation/dedup/conflict pipeline.

### PDK4.7 historical reconstruction contract
PDK4.7 accepts only project-consistent PDK4.5 extracted candidates and a complete PDK4.6 clustering result whose milestones remain non-authoritative, unverified and proposed. Every atomic event must be represented by exactly one cluster; unknown, duplicated or omitted atomic-event links fail closed.

The historical reconstructor is deterministic and does not call AI. It derives `ProjectGenesis`, `ProductTimeline`, `ComponentHistory` views and bounded development phases from existing evidence while preserving the atomic events and milestone provenance that produced those views. It creates no parallel database and has no Project Memory write/confirmation path.

`ProjectGenesis` may contain original idea/goal only when explicit origin/requirement evidence exists. It records the earliest verified evidence and first relevant commit when present, but explicitly marks that earliest-known point as not proving the exact project creation date. Initial architecture, first working milestone, foundational decisions and major evolution milestones are derived only from source-backed events/milestones.

`ProductTimeline` is built from chronological PDK4.6 milestone views. Component histories retain both atomic event snapshots and milestone summaries, including lifecycle/supersession metadata. Superseded/rejected/deprecated historical facts remain visible as historical truth instead of being deleted or promoted back into current truth. Reconstruction fingerprints are deterministic over ordered semantic/cluster fingerprints, so replay or input ordering cannot silently rewrite history.

### PDK4.8 temporal/causal reconciliation contract
PDK4.8 accepts only matching non-authoritative PDK4.5 extraction, complete PDK4.6 clustering and PDK4.7 historical reconstruction outputs. Project mismatch, duplicate atomic ids, incomplete or duplicate cluster coverage, authoritative candidates and historical-count mismatch fail closed.

The reconciler is deterministic and does not call AI. It retains PDK4.6 `belongs-to-milestone` links, preserves valid explicit PDK4 relation types such as `depends-on`, and derives only bounded same-project/domain/component temporal/causal links. Deterministic relations include `next-after`, `motivated-by`, `implements`, `fixes`, `verified-by-ci`, `deployed-as`, `verified-in-runtime`, `supersedes` and `superseded-by`. An explicit relation whose target is absent becomes a gap rather than an invented node.

Evidence reconciliation preserves independent source/roadmap-plan, code, test, CI, deployment and runtime dimensions. Code or implemented state without CI evidence never becomes `ci-verified`; CI without deployment never becomes deployed; deployment without runtime evidence never becomes live-verified. Missing stronger evidence produces `missing-ci-evidence`, `missing-deployment-evidence` or `missing-runtime-evidence` records. Active plans that predate later delivery evidence without closure are reported as `stale-plan`. Missing supersession targets or successive active decision/plan records without explicit supersession are reported as `missing-supersession`. Contradictory chronology is retained as `temporal-evidence-order` rather than silently corrected.

Every DevelopmentKnowledgeGap has a deterministic identity, remains open/derived-only, and is exposed only as an unverified, unconfirmed, proposed gap candidate. Reconciliation cannot grant trust, confirmation, identity, ownership, permissions or authority and has no direct Project Memory mutation path. A deterministic reconciliation fingerprint covers the ordered source event fingerprints, PDK4.6 clustering fingerprint, PDK4.7 reconstruction fingerprint, relation ids and gap ids so replay/input order cannot silently change reconciled history.

### PDK4.9 continuous GitHub ingestion contract
PDK4.9 operates only after the project/repository-specific PDK4.2 GitHub historical cursor is complete. Its bootstrap anchor must be the canonical `github:<repository>:commit:<full SHA>` source identity; the immutable SHA from that identity initializes the incremental cursor so the first continuous poll starts strictly after historical bootstrap rather than from an empty cursor.

The trigger surface is bounded to polling, approved webhook delivery and internal event scheduling. A webhook is only a wake-up/metadata signal: repository identity is checked, but webhook text or commit payload does not become trusted evidence. Every unseen commit is independently passed through PDK4.3 immutable verification and then the existing PDK4.4/PDK4.5 significance/extraction boundaries. Suppressed or supporting-only changes are recorded as processed source bookkeeping and advance the incremental cursor, but they cannot create DevelopmentEvents or Project Memory facts.

Continuous bookkeeping is durable and separate from Project Memory facts:

```text
pdk4_continuous_ingestion_state
pdk4_continuous_processed_sources
pdk4_continuous_triggers
```

State is project/repository scoped. Trigger receipts use `processing`, `completed` and `failed`; completed/in-flight duplicate deliveries are ignored, while a failed trigger may retry. Processed source identities/fingerprints prevent duplicate commit processing across trigger replay and PostgreSQL restart. A source is recorded only after its bounded processing result succeeds; failures remain visible and do not fabricate cursor progress.

Event-eligible output can enter Project Memory only as the existing unverified/unconfirmed PM3 candidate. Any incremental reconciliation output must remain `confirmed=false` and `authorityAllowed=false`. Authorization is checked before GitHub fetch, observability records bounded source/trigger outcomes, and invalid bootstrap anchors, bootstrap drift, cross-project/repository mismatch, source-result mismatch or attempted trust/authority promotion fail closed. PDK4.9 adds no direct provider/AI path: any model assistance remains inside PDK4.4/PDK4.5 AI Router contracts.

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

ProjectGenesis is a derived view over evidence-backed facts; it is not a privileged identity source and cannot redefine canonical SG identity. PDK4.7 implements this view as rebuildable, `historical-derived`, unconfirmed and non-authoritative output. `earliestVerifiedEvidence` is qualified as earliest-known evidence unless separate evidence proves an exact creation date.

## Significance filtering
Not every source event becomes a durable development fact.

PDK4.4 deterministically prefers changes that materially affect:
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

Formatting-only changes, trivial renames, generated noise and non-semantic churn may be recorded only as processed source evidence/checkpoint metadata and omitted from Project Memory. Ambiguous changes are retained for bounded classification rather than silently dropped. Significance classification does not itself create a durable Project Memory fact.

## Commit and event clustering
One product change may span multiple commits, tests and documentation updates. PDK4.6 clusters only compatible PDK4.5 atomic events into bounded milestone candidates while preserving all individual source references and atomic event identities.

The deterministic merge boundary uses project, domain, normalized component, temporal proximity and semantic anchors. Distinct project/domain/component/time scopes are hard-separated even when text is similar. Ambiguous compatible pairs may use AI-assisted semantic analysis only through AI Router. AI can only advise merge/split and cannot promote a cluster to verified truth.

Supporting PDK4.4 evidence such as successful CI workflows may attach to a cluster only through explicit known atomic-event links. It remains supporting audit/correlation evidence and does not silently upgrade the milestone's lifecycle or verification state. Milestones expose `belongs-to-milestone` relation links back to every atomic event, deterministic fingerprints for replay, and unverified/proposed PM3 candidates rather than direct durable facts.

## Historical reconstruction
PDK4.7 reconstructs complementary rebuildable views:

1. **Project Genesis** — earliest-known evidence, first relevant commit, evidence-backed idea/goal when explicitly present, initial architecture, first working milestone, foundational decisions and major evolution milestones.
2. **Product Timeline** — major chronological milestone views with atomic-event/source auditability.
3. **Component History** — origin, decisions, implementations, reworks, incidents, milestones and superseded history for each product component.
4. **Development Phases** — bounded chronological phase groups derived from event semantics and evidence-compatible lifecycle states.

Historical facts remain queryable after supersession and are not deleted. PDK4.7 does not infer an exact creation date from an earliest commit/evidence point, and it does not independently decide current truth; later PM3 retrieval/Context Guard and PDK4 reconciliation/current-snapshot stages remain responsible for current-state semantics.

## Continuous Development Ingestion
PDK4.9 implements the transition from one-time historical reconstruction to restart-safe incremental processing.

```text
completed PDK4.2 cursor
→ immutable bootstrap SHA
→ authorized bounded trigger
→ durable incremental cursor
→ unseen GitHub commit identities only
→ PDK4.3 immutable verification
→ PDK4.4 significance classification
→ non-event bookkeeping OR PDK4.5 extraction
→ unconfirmed PM3 candidate
→ bounded reconciliation update
→ durable source/cursor commit
→ completed trigger receipt
```

The incremental cursor is durable and repository/source scoped. Replay is idempotent. A failed trigger can retry; a completed trigger/source cannot duplicate processing. Suppressed/non-event commits are still remembered as processed bookkeeping so polling cannot loop on them, but they never become durable project facts.

Continuous ingestion may be triggered by approved GitHub webhook/event delivery or bounded polling/worker scheduling. The trigger mechanism does not bypass External Connections Registry, Resource Authority, secrets policy, Owner Security or observability, and webhook payloads never replace immutable GitHub verification.

## Reconciliation Engine
PDK4.8 implements deterministic reconciliation of independent evidence surfaces without silently promoting state.

Examples:

```text
roadmap: CLOSED
code: present
CI: SUCCESS
deployment: unknown
runtime: unknown
```

The result preserves each dimension instead of collapsing them into one ambiguous `done` flag. Source/roadmap-plan, code, test, CI, deployment and runtime evidence remain separately inspectable.

PDK4.8 detects:
- implementation/code without CI evidence;
- CI without deployment evidence;
- deployment without live verification;
- stale active plans after later delivery evidence;
- missing or unknown supersession targets;
- successive active decision/plan records without explicit supersession;
- explicit relation targets missing from the reconciled history;
- contradictory evidence chronology.

Unresolved discrepancies become deterministic `DevelopmentKnowledgeGap` records and unverified/proposed candidates, not invented answers. PDK4.8 does not claim that an unavailable deployment/runtime connector has supplied evidence; those dimensions remain unknown until independently verified.

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

PDK4.7 historical reconstruction and PDK4.8 temporal/causal reconciliation themselves do not call AI; this prevents model summarization from manufacturing genesis/history/causal facts or evidence states. PDK4.9 adds no direct model call and only reuses the existing PDK4.4/PDK4.5 Router-controlled assistance paths.

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

Replay must not duplicate Project Memory facts or advance trust. PDK4.6 additionally derives deterministic cluster and aggregate fingerprints from ordered atomic semantic fingerprints plus attached supporting-source fingerprints; replay cannot use clustering to confirm facts or change trust. PDK4.7 derives a deterministic reconstruction fingerprint from ordered atomic semantic fingerprints, cluster fingerprints and timeline milestone ids; input ordering cannot alter the resulting historical identity. PDK4.8 derives deterministic relation/gap identities and a reconciliation fingerprint from the validated PDK4.5/PDK4.6/PDK4.7 evidence identity plus ordered relation/gap ids; replay or input ordering cannot silently promote or rewrite reconciliation state. PDK4.9 additionally binds incremental processing to the full immutable commit SHA, persistent processed-source fingerprint and trigger id; restart/retry cannot reprocess a completed source or advance trust, while a failed trigger remains retryable without inventing cursor progress.

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
- Clustering cannot collapse events across hard project/domain/component/time boundaries solely because model/text similarity is high.
- Supporting workflow/CI evidence cannot silently promote a milestone's evidence state.
- Historical reconstruction cannot treat earliest-known evidence as an exact project creation date without separate proof.
- Derived genesis/timeline/component history cannot grant trust, confirmation or authority and cannot replace source-level atomic events.
- Temporal/causal reconciliation cannot infer stronger evidence state from weaker evidence or invent missing relation targets.
- DevelopmentKnowledgeGap output cannot self-confirm, grant authority or substitute for PM3 trust/confirmation.
- Contradictory evidence chronology must remain visible instead of being silently reordered into consistency.
- Continuous ingestion cannot use webhook payloads as verified truth, cannot start from an unanchored null cursor after bootstrap, and cannot let failed/duplicate triggers fabricate source progress.
- Suppressed incremental commits may advance bookkeeping only; they cannot create DevelopmentEvents or PM3 facts.

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