# SG 2.1 — UNIVERSAL DIAGNOSTICS PROGRAM

## Status

Planned and architecturally specified. Not implemented by this documentation change.

## Program identity

Universal Diagnostics is a separate cross-cutting program for SG 2.1. It is not a new SG core layer, does not renumber Blocks 0–19, and does not become a mandatory hop in ordinary user requests.

Canonical implementation sequence:

`D1 Diagnostic Contract & Read-Only Boundary → D2 Collector & Evidence Storage → D3 Trace Reconstruction → D4 Expected Paths & Invariants → D5 First Divergence Engine → D6 Root Cause Analyzer → D7 Deployment/Runtime/Infrastructure Diagnostics → D8 Live Diagnostic Runner → D9 Replay & Regression Library → D10 Reports/API/UI/Security → D11 E2E Verification → D12 Independent Production Deployment`.

Architecture: `../architecture/UNIVERSAL_DIAGNOSTICS.md`.
Workflow: `../workflow/UNIVERSAL_DIAGNOSTICS_WORKFLOW.md`.

## Goal

Create an independent diagnostic application that can determine:

1. where SG first diverged from the expected execution path;
2. why the divergence occurred;
3. which failure is the root cause and which failures are downstream effects;
4. what evidence proves the conclusion;
5. which component or boundary should be inspected or repaired.

The program must replace guess-based debugging with evidence-based diagnosis.

## Core rule

SG emits bounded facts. Universal Diagnostics analyzes those facts.

```text
SG runtime / workers / transports / providers
              │
              │ diagnostic facts and read-only evidence
              ▼
      Universal Diagnostics
              │
              ├─ reconstructs traces
              ├─ compares expected vs actual paths
              ├─ checks invariants
              ├─ finds first divergence
              ├─ separates cause from effects
              └─ produces evidence-backed reports
```

If Universal Diagnostics is unavailable, SG must continue ordinary operation.

## Required boundaries

- Universal Diagnostics is not Semantic Kernel, Decision Engine, Action Gate, Capability System, AI Router, Memory, Self Knowledge or Transport.
- It does not decide ordinary user intent.
- It does not authorize or execute ordinary SG actions.
- It is read-only by default.
- It cannot grant identity, roles, permissions, ownership or resource authority.
- It cannot change code, configuration, environment variables, database state, deployment state or external resources during diagnosis.
- Any future remediation mode must be a separate explicitly approved program/phase and must pass the normal SG security and action-control boundaries.
- Diagnostics must never become a second brain for SG.

## SG-side instrumentation boundary

The SG codebase may contain only the diagnostic sensors/contracts needed to expose bounded facts. Examples:

- request received/completed/failed;
- transport receive/delivery stages;
- identity and scope resolution outcome;
- settings/conversation/language context resolution;
- memory query/capture lifecycle;
- semantic decision lifecycle;
- Action Gate decision;
- capability start/complete/fail/timeout;
- AI Router/provider attempts, retry and fallback lifecycle;
- response-context and final-response-guard outcome;
- worker/task lifecycle;
- deployment/runtime revision evidence;
- persistence and dependency health.

These sensors report facts only and must not alter runtime decisions.

## Canonical diagnostic event requirements

Every diagnosable stage must expose enough bounded evidence to correlate execution without leaking secrets or unnecessary private content.

Minimum fields where applicable:

- `diagnostic_event_version`;
- `event_id`;
- `trace_id`;
- `request_id`;
- `parent_span_id` / `span_id` where used;
- `diagnostic_run_id` for synthetic tests;
- `test_case_id` for synthetic tests;
- `stage`;
- `component`;
- `operation`;
- `status` (`started`, `completed`, `failed`, `timeout`, `skipped`, `degraded`, `missing` when inferred by analyzer);
- `occurred_at`;
- `duration_ms` when known;
- `error_code` and bounded error class;
- `retry_attempt` / `fallback_from` where relevant;
- `environment`;
- `runtime_revision` / Git commit evidence where available;
- schema/contract version where relevant;
- safe dependency/provider identifier;
- redacted evidence metadata.

Raw secrets are forbidden. Raw message content is excluded by default unless a narrowly authorized diagnostic case explicitly requires bounded content evidence.

## Diagnostic error classes

Universal Diagnostics normalizes findings into a stable taxonomy:

- `DEPLOYMENT`;
- `CONFIGURATION`;
- `TRANSPORT`;
- `IDENTITY`;
- `AUTHORIZATION`;
- `SCOPE`;
- `CONTEXT`;
- `MEMORY`;
- `SEMANTIC`;
- `ACTION_GATE`;
- `CAPABILITY`;
- `AI_ROUTER`;
- `AI_PROVIDER`;
- `SOURCE`;
- `PERSISTENCE`;
- `WORKER`;
- `RESPONSE`;
- `DELIVERY`;
- `SECURITY`;
- `UNKNOWN`.

A visible symptom is not automatically a root cause.

## Expected Path Registry

The diagnostic application stores declarative expected execution paths for supported flows, for example:

```text
conversation:
transport → identity → scope/context → semantic → action-gate → compose-answer → ai → final-response-guard → delivery

memory recall:
identity → scope → memory-retrieval → context-assembly → answer

task execution:
semantic → action-gate → task-create → persistence → scheduler/queue → worker → execution

external source:
semantic → action-gate → connection/resource-authority → source-retrieve → validation → answer
```

The registry describes expected observability, not business logic. It cannot change the SG execution path.

## Invariant Engine

Diagnostics checks stable rules such as:

- required `global_user_id` resolution exists before personal scope operations;
- memory scope matches the resolved actor/resource scope;
- protected capability execution follows an allowed Action Gate decision;
- capability/provider completion follows a start event unless a bounded failure/timeout explains termination;
- final response is non-empty and exact echo is rejected unless explicitly allowed by the response contract;
- delivery success is distinct from execution success;
- deployed runtime/worker revisions match the approved deployment revision when required;
- contract/schema versions are compatible;
- diagnostic synthetic runs cannot enter ordinary durable memory or alter user settings.

## First Divergence Engine

The primary deterministic algorithm compares expected and actual execution and identifies the earliest materially wrong stage.

Example:

```text
EXPECTED                      ACTUAL
transport ✅                  transport ✅
identity ✅                   identity ✅
semantic ✅                   semantic ✅
action-gate ✅                action-gate ✅
compose-answer ✅             compose-answer ❌ timeout
response-guard ✅             response-guard missing
delivery ✅                   delivery missing
```

Result:

- first divergence: `compose-answer`;
- downstream missing stages are effects, not independent root causes.

## Root Cause Analyzer

The analyzer follows deterministic evidence from the first divergence into relevant child/dependency events.

It must:

- distinguish primary failure from propagation effects;
- inspect retries/fallbacks/timeouts/dependency failures;
- use known incident signatures only as hints;
- never declare an old historical cause as the current cause without current evidence;
- emit confidence: `CONFIRMED`, `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`;
- require explicit evidence references for `CONFIRMED` findings.

AI may summarize or explain a completed diagnosis, but deterministic evidence analysis is authoritative.

## Deployment Proof

Every production diagnosis must be able to compare, when sources are available:

- approved branch;
- GitHub HEAD;
- CI commit SHA/result;
- deployed web runtime revision;
- deployed worker revision;
- runtime-reported revision;
- database migration/schema version;
- contract version.

Version mismatch must be diagnosed before proposing code changes.

## Dependency Diagnostics

The analyzer models dependencies so one unavailable dependency does not appear as many unrelated root causes.

Example:

```text
PostgreSQL unavailable
├─ conversation context degraded
├─ memory unavailable
├─ task persistence unavailable
└─ identity persistence affected
```

The report identifies the primary dependency failure and lists affected downstream systems separately.

## Live Diagnostic Runner

Universal Diagnostics may run controlled synthetic checks against approved diagnostic surfaces.

Synthetic tests use dedicated metadata:

- `diagnostic=true`;
- `diagnostic_run_id`;
- `test_case_id`;
- dedicated diagnostic actor/scope where applicable.

Synthetic diagnostics must not:

- create ordinary long-term memory;
- alter psychological/profile state;
- create ordinary user tasks unless the test uses an isolated disposable diagnostic store/scope;
- modify user preferences;
- broaden permissions or authority;
- pollute real conversation analytics as ordinary traffic.

Examples of controlled cases:

- basic conversation;
- SG self-identity;
- verified user identity;
- memory write/recall in isolated diagnostic scope;
- Action Gate allow/deny fixtures;
- AI Router/provider availability;
- database readiness;
- worker queue lifecycle;
- Telegram delivery where an approved test target exists;
- deployment revision consistency.

## Replay & Regression Library

A diagnosed incident may become a reproducible regression scenario.

Replay must use bounded captured evidence/fixtures rather than silently re-executing protected real-world actions.

Each regression record may contain:

- stable incident/signature ID;
- symptom;
- confirmed root cause;
- affected component;
- fixed revision/commit where known;
- deterministic fixture/test case;
- expected old failure;
- expected current behavior.

Historical incidents guide investigation but never override live evidence.

## Diagnostic Knowledge Base

The program stores technical incident knowledge only, not ordinary user memory.

Allowed records include:

- error signatures;
- component mappings;
- known causes;
- required evidence;
- incident history;
- fixed revision;
- linked regression tests.

## Evidence storage

Use an independent diagnostics schema/database boundary where practical, for example:

- `diagnostic_runs`;
- `diagnostic_checks`;
- `diagnostic_events`;
- `diagnostic_findings`;
- `diagnostic_evidence`;
- `diagnostic_incidents`;
- `diagnostic_regressions`.

Original SG observability may remain in its existing store. Universal Diagnostics reads and correlates it through a bounded read-only interface.

## Report contract

A standard report must contain:

- overall status;
- diagnosed request/run/trace;
- environment and revision evidence;
- visible symptom when provided;
- first divergence;
- root-cause class;
- root-cause component;
- expected vs actual evidence;
- downstream effects;
- confidence;
- evidence references;
- suggested inspection/fix area;
- unresolved unknowns.

Raw log dumps are supporting evidence, not the primary report.

## Security

Detailed diagnostics are privileged operational data.

- full reports are owner/Monarch-only unless explicitly delegated;
- non-privileged health surfaces expose only bounded states such as `healthy`, `degraded`, `unavailable`;
- secrets and sensitive payloads remain redacted;
- diagnostics uses least-privilege read-only credentials by default;
- diagnostic access itself is audited;
- no diagnostic secret phrase/command may establish owner identity.

# D1 — Diagnostic Contract & Read-Only Boundary

Deliverables:
- canonical diagnostic event contract;
- stage/status/error taxonomy;
- privacy/redaction requirements;
- read-only source interfaces;
- explicit separation from SG core decisions.

Gate:
- disabling Diagnostics cannot break SG runtime.

# D2 — Collector & Evidence Storage

Deliverables:
- collectors for SG observability/runtime/dependency evidence;
- independent diagnostics persistence;
- correlation/indexing by trace/request/run/revision;
- evidence retention policy.

Gate:
- collector failures cannot mutate SG.

# D3 — Trace Reconstruction

Deliverables:
- request/worker/delivery trace reconstruction;
- parent/child span correlation;
- missing-stage detection;
- timeline generation.

Gate:
- one trace can be reconstructed deterministically from available evidence.

# D4 — Expected Paths & Invariants

Deliverables:
- declarative Expected Path Registry;
- invariant library;
- versioned path definitions;
- expected-vs-actual comparison.

Gate:
- diagnostics cannot change SG path definitions at runtime.

# D5 — First Divergence Engine

Deliverables:
- earliest material divergence algorithm;
- missing-stage inference;
- cause/effect boundary representation.

Gate:
- known fixtures identify the first incorrect stage reproducibly.

# D6 — Root Cause Analyzer

Deliverables:
- deterministic dependency traversal;
- root-cause candidate ranking;
- confidence model;
- evidence requirement enforcement;
- optional post-analysis AI explanation only after deterministic result.

Gate:
- no confirmed root cause without evidence.

# D7 — Deployment / Runtime / Infrastructure Diagnostics

Deliverables:
- GitHub/CI/deployed revision proof;
- web/worker/schema compatibility checks;
- database/provider/transport/worker health correlation;
- dependency graph diagnostics.

Gate:
- deployment mismatch is detectable before code-level blame.

# D8 — Live Diagnostic Runner

Deliverables:
- isolated synthetic diagnostic runs;
- safe standard test catalogue;
- diagnostic metadata/scope;
- anti-pollution controls for memory/settings/tasks/analytics.

Gate:
- diagnostics can test the system without becoming ordinary user activity.

# D9 — Replay & Regression Library

Deliverables:
- bounded trace/fixture replay;
- incident-to-regression conversion;
- before/after comparison;
- historical technical knowledge base.

Gate:
- replay cannot trigger protected real-world effects by default.

# D10 — Reports, API/UI & Security

Deliverables:
- standard DiagnosticReport contract;
- query by trace/request/run/time/revision/component;
- owner-secured API/UI;
- bounded non-privileged health view;
- evidence drill-down;
- diagnostic-access audit.

Gate:
- reports separate root cause, evidence, effects and unknowns.

# D11 — E2E Verification of Diagnostics

Required scenarios include:
- transport failure;
- identity mismatch;
- scope mismatch;
- memory failure;
- semantic/capability mismatch;
- Action Gate denial;
- capability timeout;
- AI retry/fallback/provider failure;
- response-guard failure;
- delivery failure;
- database/worker outage;
- deployment revision mismatch;
- missing telemetry stage;
- multi-failure propagation with one primary root cause;
- secret/private-data redaction;
- Diagnostics unavailable while SG remains healthy.

Gate:
- deterministic expected findings match actual reports.

# D12 — Independent Production Deployment

Target deployment:
- independent Diagnostics process/service;
- separate runtime entrypoint;
- separate Render service or equivalent deployment unit;
- independent health/readiness;
- read-only credentials by default;
- independent failure domain;
- optional later extraction into a separate repository without changing diagnostic contracts.

Gate:
- stopping Diagnostics does not stop SG;
- stopping SG produces an observable dependency state in Diagnostics rather than corrupting Diagnostics data.

## Program acceptance criteria

Universal Diagnostics is complete only when:

- [ ] it is physically and logically independent from the ordinary SG request path;
- [ ] SG-side instrumentation contains only bounded fact emission/read surfaces;
- [ ] one trace can be reconstructed across the supported runtime path;
- [ ] expected-vs-actual execution can be compared deterministically;
- [ ] first divergence is identified;
- [ ] root cause is separated from downstream effects;
- [ ] confirmed findings contain evidence;
- [ ] deployment/version mismatch is detectable;
- [ ] dependency failures are correlated rather than duplicated as unrelated causes;
- [ ] live synthetic tests are isolated from real memory/settings/tasks/analytics;
- [ ] replay/regression cannot trigger protected real-world effects by default;
- [ ] owner-only detailed diagnostics and bounded public health are enforced;
- [ ] secrets/private content remain redacted/minimized;
- [ ] Diagnostics failure cannot break ordinary SG operation;
- [ ] E2E fixtures prove representative failure classes;
- [ ] independent deployment and rollback are verified.

## Non-goals

This program does not implement self-healing, autonomous code repair, automatic environment mutation, automatic deploy/rollback, automatic permission changes or autonomous incident remediation. Those require separate explicit architectural approval if ever introduced.
