# SG 2.1 — UNIVERSAL DIAGNOSTICS ARCHITECTURE

## Status

Canonical architecture for the planned Universal Diagnostics program.

This document defines system boundaries and component responsibilities. It does not mark implementation complete.

## Architectural decision

Universal Diagnostics is an independent operational application around SG 2.1, not a new SG core layer and not part of the mandatory request execution chain.

SG remains fully functional when Diagnostics is stopped or unavailable.

```text
                           ┌───────────────────────────────┐
                           │      Universal Diagnostics    │
                           │                               │
                           │ Collector                     │
                           │ Trace Reconstruction           │
                           │ Expected Path Registry         │
                           │ Invariant Engine               │
                           │ First Divergence Engine        │
                           │ Root Cause Analyzer            │
                           │ Deployment/Dependency Checks   │
                           │ Replay/Regression              │
                           │ Reports/API/UI                 │
                           └───────────────▲───────────────┘
                                           │
                                  read-only evidence
                                           │
┌──────────────────────────────────────────┴─────────────────────────────────────┐
│                                  SG 2.1                                       │
│                                                                              │
│ Transport → Identity/Scope → Context → Semantic → Gate → Capability/AI       │
│      → Response Guard → Delivery                                             │
│                                                                              │
│ Runtime / Workers / Persistence / Providers emit bounded diagnostic facts     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Separation of responsibilities

### SG owns
- ordinary user request processing;
- identity and scope;
- context/memory boundaries;
- Semantic Kernel;
- Decision Engine;
- Action Gate;
- capability execution;
- AI Router;
- delivery;
- normal observability fact emission;
- runtime health/readiness.

### Universal Diagnostics owns
- collection of bounded diagnostic evidence;
- reconstruction of request/task/delivery timelines;
- expected-vs-actual path comparison;
- invariant evaluation;
- first-divergence detection;
- deterministic root-cause analysis;
- dependency and deployment correlation;
- diagnostic replay fixtures;
- regression incident library;
- evidence-backed diagnostic reports;
- owner-secured diagnostic API/UI.

### Universal Diagnostics does not own
- SG identity or owner authority;
- Semantic Kernel;
- permissions or grants;
- Resource Authority;
- Action Gate;
- capability selection/execution;
- user memory;
- Self Knowledge;
- production state mutation;
- automatic repair.

## Failure-domain rule

Diagnostics is not allowed to become a production availability dependency.

Required property:

```text
Diagnostics DOWN  → SG ordinary request path still works
SG DOWN           → Diagnostics reports SG dependency unavailable
```

No synchronous call from the ordinary SG request path may require Diagnostics to approve or complete ordinary work.

## SG-side sensor model

Only a thin instrumentation boundary belongs inside SG.

A sensor:
- emits a fact about a stage already being executed;
- carries trace/revision/component metadata;
- applies redaction/minimization;
- does not change control flow;
- does not authorize anything;
- does not reinterpret user intent;
- does not generate a diagnosis.

Existing Observability remains the preferred fact-emission foundation. New diagnostic fields/events must extend canonical observability contracts rather than create ad hoc logging channels where possible.

## Canonical stage model

Supported stage vocabulary is versioned and may include:

- `transport.receive`;
- `transport.normalize`;
- `identity.resolve`;
- `scope.resolve`;
- `settings.resolve`;
- `conversation.resolve`;
- `language.resolve`;
- `memory.capture`;
- `memory.recall`;
- `semantic.process`;
- `action.request`;
- `action-gate.evaluate`;
- `capability.execute`;
- `ai-router.route`;
- `ai-provider.call`;
- `response-context.assemble`;
- `response-guard.evaluate`;
- `delivery.route`;
- `transport.deliver`;
- `task.persist`;
- `scheduler.enqueue`;
- `worker.claim`;
- `worker.execute`;
- `persistence.query`/`persistence.transaction` where bounded evidence is required;
- `runtime.health`;
- `deployment.revision`.

The vocabulary must remain semantic enough for diagnosis and stable enough for versioned analysis. Internal implementation details may be attached as metadata without becoming the canonical stage identity.

## Diagnostic event contract

A diagnostic event is a fact, not a command.

Representative contract:

```text
DiagnosticEvent
- version
- eventId
- traceId
- requestId
- spanId
- parentSpanId
- diagnosticRunId?
- testCaseId?
- stage
- component
- operation
- status
- occurredAt
- durationMs?
- errorClass?
- errorCode?
- retryAttempt?
- fallbackFrom?
- environment
- revision
- schemaVersion?
- safeDependencyRef?
- evidenceMetadata (redacted/minimized)
```

Allowed statuses:

- `started`;
- `completed`;
- `failed`;
- `timeout`;
- `skipped`;
- `degraded`.

`missing` is normally an analyzer conclusion produced when an expected event is absent; SG does not need to emit a literal missing event.

## Privacy and redaction

Diagnostics follows a stricter default than ordinary application logging.

Default rules:
- no raw secret values;
- no API keys/tokens/passwords;
- no credential payloads;
- no full user message bodies unless specifically authorized for a bounded incident;
- no full memory contents by default;
- no unrestricted provider prompts/responses;
- store hashes/IDs/categories/counts/statuses where sufficient;
- preserve enough metadata to prove scope and execution without exposing content.

Owner access does not disable redaction of raw secrets.

## Evidence sources

Universal Diagnostics may consume, through least-privilege read-only adapters:

1. SG Observability store/service;
2. runtime health/readiness endpoints;
3. PostgreSQL metadata/read-only diagnostic queries;
4. worker/scheduler health and task lifecycle evidence;
5. AI Router/model-call telemetry;
6. transport delivery evidence;
7. GitHub branch/commit/CI evidence;
8. Render deployment/runtime revision evidence where connected;
9. schema/migration/contract-version state;
10. approved external provider health evidence.

A source adapter returns normalized evidence and must identify source freshness and provenance.

## Collector

Collector responsibilities:
- pull or receive diagnostic facts;
- normalize them into versioned evidence records;
- deduplicate by stable event identity;
- preserve source provenance;
- index by trace/request/run/revision/component/time;
- tolerate partial source outages;
- never mutate the observed SG state.

Collector outages produce Diagnostics degradation, not SG failure.

## Diagnostic persistence

Diagnostics should use a separate schema/database boundary where practical.

Canonical entities:

```text
diagnostic_runs
diagnostic_checks
diagnostic_events
diagnostic_findings
diagnostic_evidence
diagnostic_incidents
diagnostic_regressions
```

The original SG observability store remains authoritative for original SG-emitted events. Diagnostic storage may copy normalized references/evidence for analysis while preserving provenance.

## Trace Reconstruction Engine

Input:
- `traceId`, `requestId`, `diagnosticRunId`, or bounded search criteria.

Output:
- ordered timeline;
- parent/child execution relationships;
- component boundaries;
- retry/fallback branches;
- execution vs delivery branches;
- missing expected stages;
- revision/environment attached to the trace.

Reconstruction is deterministic for the same evidence set and path definition version.

## Expected Path Registry

Expected paths are declarative diagnostic specifications, not executable business logic.

Example:

```text
path: conversational-response/v1
required:
  transport.receive
  identity.resolve
  semantic.process
  action-gate.evaluate
  capability.execute(compose-answer)
  response-guard.evaluate
  transport.deliver
conditional:
  ai-router.route when AI composition is enabled
  ai-provider.call when a provider attempt is made
```

Each path definition has:
- stable ID/version;
- applicability conditions;
- required stages;
- conditional stages;
- allowed alternatives/fallbacks;
- ordering constraints;
- terminal success/failure states;
- linked invariants.

Updating a diagnostic path cannot alter SG runtime execution.

## Invariant Engine

An invariant is a rule that must hold for evidence to be considered internally consistent.

Examples:
- personal memory access has a resolved actor global ID;
- group/thread memory uses the same resolved scope as the request;
- protected capability start follows an allowed Action Gate result;
- provider fallback follows a failed/retryable prior attempt where policy permits;
- final response guard occurs before normal delivery of composed conversational output;
- response success and delivery success are separately represented;
- deployed runtime revision is compatible with the approved revision claim;
- synthetic diagnostics cannot write to ordinary user memory/settings.

Invariant evaluation returns evidence references and severity; it does not mutate SG.

## First Divergence Engine

This is the primary localization algorithm.

Given an expected path and reconstructed trace:

1. evaluate path applicability;
2. walk expected stages in causal order;
3. validate ordering and invariants;
4. identify the first material mismatch, failed stage, timeout or unexplained missing stage;
5. mark later failures/missing stages as downstream candidates until proven independent.

Output:

```text
FirstDivergence
- pathId/version
- stage
- component
- expectedState
- actualState
- evidenceRefs
- downstreamCandidateRefs
```

The earliest timestamp alone is insufficient; causal ordering and expected-path rules determine first divergence.

## Root Cause Analyzer

Root-cause analysis begins from the first divergence and traverses only relevant dependencies/children.

It evaluates:
- explicit error codes/classes;
- timeout ownership;
- retry/fallback history;
- dependency availability;
- revision/schema mismatch;
- missing completion/acknowledgement;
- gate/authority evidence;
- provider responses;
- known incident signatures.

Historical signatures are advisory. Current evidence always wins.

Canonical confidence levels:
- `CONFIRMED` — direct evidence satisfies a deterministic rule;
- `HIGH` — strongly supported but one required evidence source is unavailable;
- `MEDIUM` — multiple plausible causes remain;
- `LOW` — weak evidence;
- `UNKNOWN` — insufficient evidence to isolate cause.

A `CONFIRMED` root cause requires explicit evidence references.

## Cause vs effect graph

Findings form a causal graph:

```text
root cause
   ↓
propagation effect
   ↓
secondary stage failure
   ↓
user-visible symptom
```

Multiple independent root causes are allowed only when the evidence shows separate causal branches.

## Deployment Proof Engine

Deployment diagnosis compares:
- expected branch/ref;
- approved GitHub HEAD;
- CI-tested commit;
- deployed web revision;
- deployed worker revision;
- runtime self-reported revision;
- migration/schema version;
- contract compatibility state.

A revision mismatch is reported as a deployment-class first divergence where appropriate and must be considered before blaming code known to exist only in a newer revision.

## Dependency Graph Engine

Diagnostics models dependencies independently from request paths.

Representative nodes:
- web runtime;
- worker;
- PostgreSQL;
- AI provider;
- Telegram/provider transport;
- credential/connection availability;
- internal event persistence;
- scheduler/queue.

Dependency failure propagation is represented explicitly so one outage does not produce many false independent root causes.

## Live Diagnostic Runner

The runner executes approved synthetic checks with explicit diagnostic metadata.

Required isolation:
- `diagnostic=true`;
- dedicated `diagnostic_run_id` and `test_case_id`;
- isolated diagnostic actor/scope where needed;
- ordinary long-term memory capture disabled for diagnostic traffic;
- user preferences/profile adaptation disabled;
- real protected actions blocked unless a specifically approved non-destructive test fixture exists;
- test artifacts disposable and identifiable.

The runner is not an alternate command path for privileged SG actions.

## Replay Engine

Replay operates on bounded evidence/fixtures.

Default replay is analysis-only and does not resend external messages, execute market/project actions, mutate live settings, modify permissions or re-run arbitrary provider side effects.

Protected-effect replay requires separate explicit architecture and authorization if ever introduced.

## Regression Library

Each confirmed incident may produce a stable regression case:

```text
RegressionCase
- regressionId
- symptomSignature
- rootCauseClass
- component
- requiredEvidence
- fixture
- expectedFailureBeforeFix
- expectedBehaviorAfterFix
- fixedRevision?
```

The regression library protects against repeated historical failures while preserving evidence-first diagnosis.

## Diagnostic Knowledge Base

The knowledge base contains technical incident metadata only.

It is not SG personal memory, Project Memory or Self Knowledge.

It may store:
- error signatures;
- past confirmed causes;
- evidence requirements;
- affected components;
- fix revisions;
- regression links.

It cannot redefine current component status without fresh evidence.

## Reporting boundary

`DiagnosticReport` is the primary human/API output.

Required fields:
- status;
- trace/run reference;
- symptom;
- environment/revision;
- expected path;
- first divergence;
- root cause class/component;
- expected vs actual evidence;
- downstream effects;
- confidence;
- evidence references;
- suggested inspection area;
- unresolved unknowns.

The report does not claim a repair was applied unless a separate authorized remediation system provides verified evidence.

## Access control

Detailed diagnostics expose privileged operational information.

Rules:
- full diagnostic access is owner/Monarch-only by default;
- delegation must be explicit, bounded and revocable;
- non-privileged status endpoints return only bounded health states;
- owner identity remains rooted in canonical `global_user_id` and existing Owner Security;
- Diagnostics never creates its own identity shortcut, phrase, username or secret-word bypass;
- read access and synthetic test execution are audited separately.

## AI usage inside Diagnostics

AI is optional and downstream of deterministic analysis.

Allowed uses:
- summarize a completed deterministic report;
- explain evidence in natural language;
- suggest investigation hypotheses clearly labeled as hypotheses.

AI must not:
- decide the authoritative first divergence;
- silently replace invariant/path evaluation;
- declare `CONFIRMED` root cause without deterministic evidence;
- change SG/Diagnostics state through the analysis path.

## Deployment architecture

Initial recommended topology:

```text
same repository
├─ SG runtime code
├─ worker code
└─ independent Diagnostics application/entrypoint

Render / deployment
├─ SG web service
├─ SG worker service
├─ PostgreSQL
└─ SG Diagnostics service
```

A later repository split is allowed if diagnostic contracts remain versioned and compatible.

Diagnostics has independent:
- process lifecycle;
- health/readiness;
- credentials;
- release/rollback;
- storage boundary where configured;
- failure domain.

## Non-negotiable architecture boundaries

- Diagnostics is not in the mandatory SG request path.
- Diagnostics cannot grant authority.
- Diagnostics cannot bypass Action Gate or Owner Security.
- Diagnostics is read-only by default.
- Diagnostics failure cannot break SG.
- SG instrumentation emits facts only.
- Secret/private data is minimized and redacted.
- Root cause is evidence-backed, not model-guessed.
- Historical incidents are hints, not current truth.
- Synthetic tests are isolated from ordinary memory/settings/tasks/profile state.
- Replay cannot execute protected real-world effects by default.
- Autonomous repair/self-healing is outside this architecture and requires separate approval.
