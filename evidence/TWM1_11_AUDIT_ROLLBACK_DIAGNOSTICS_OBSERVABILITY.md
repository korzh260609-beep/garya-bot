# TWM1.11 — Audit / Rollback / Diagnostics & Observability Evidence

## Status
**IMPLEMENTED / CI-VERIFIED — canonical status-document synchronization and closure-head CI still required before external CLOSED declaration.**

Implementation baseline before TWM1.11:
- TWM1.10 closure HEAD: `24488e555f541f0a8381ac280c19626364fc8f13`;
- SG 2.1 CI #7372 — SUCCESS.

TWM1.11 implementation HEAD verified before this evidence commit:
- HEAD: `f41328b9216cca794a298df100002875178f3c2b`;
- SG 2.1 CI #7376 — SUCCESS.

## Requirement map

### 1. Who / what / when / before / after history
Implemented by `src/telegramWorkspace/telegramWorkspaceDiagnosticsObservability.js` over the existing authorized `WorkspaceConfigurationService.history()` boundary.

The diagnostics facade normalizes persisted history into:
- `version`;
- `who` from canonical `actor_global_user_id`;
- `what.namespace` and mutation reason;
- `when` from the persisted history timestamp;
- `before`;
- `after`;
- `traceId`.

Before/after values are recursively secret-redacted before exposure by the diagnostics facade.

The underlying append-only source remains the existing TWM PostgreSQL configuration/history transaction; no second history database is introduced.

### 2. Authorized rollback as a new audited mutation
`createTelegramWorkspaceDiagnosticsObservabilityService().rollback()` delegates unchanged to the existing protected `WorkspaceConfigurationService.rollback()` path.

That existing path already performs:
- fresh workspace authority validation;
- risk classification;
- canonical SG Action Gate evaluation;
- request-bound confirmation / replay protection;
- a new atomic configuration version write;
- append-only history retention;
- mutation event and audit emission.

TWM1.11 therefore does not create a second rollback implementation or bypass TWM1.6/TWM1.7.

### 3. Connection / authority / bot-permission / configuration health
`health()` produces a bounded immutable `TelegramWorkspaceDiagnostics` report containing:
- workspace lifecycle and effective connection state;
- fresh authorized viewer state and bounded workspace role;
- authority verification timestamp/reason;
- canonical bot capability health;
- missing bot capabilities and Telegram permissions;
- persisted configuration namespace versions and maximum version.

Diagnostics authorizes the actor before workspace/config/bot details are disclosed. Authority denial fails closed.

### 4. Degraded capability explanations
The facade reuses canonical `TelegramWorkspaceBotCapabilityService.getHealth()` results rather than inventing a second permission model.

`degradedReasons`, `missingCapabilities` and `missingPermissions` preserve actionable canonical bot capability failures such as missing Telegram administrator permissions or disconnect state. If the bot capability dependency is not configured, diagnostics explicitly reports degraded instead of claiming healthy.

### 5. Last configuration success / failure
The diagnostics layer reads existing workspace-scoped Observability audit events and reports bounded summaries of the most recent successful and unsuccessful `telegram-workspace-configuration` mutations.

Summaries include only metadata required for diagnosis: time, outcome, reason, operation, namespace, version, trace id and request id.

### 6. Authorization and Action Gate counters
Existing TWM telemetry remains the source of truth. TWM1.11 aggregates workspace-scoped audit events into:
- `configurationActions`;
- `configurationSuccesses`;
- `configurationFailures`;
- `authorizationDenials`;
- `actionGateDenials`.

No parallel counter store is introduced.

Freshness/replay counters for later content/result-ingestion stages are not fabricated before those stages exist; TWM1.11 reports counters that are applicable to the current configuration/authority/action-gate surface.

### 7. Trace continuity and secret-safe observability
Each generated diagnostics event carries canonical:
- `traceId`;
- `requestId`;
- `environment`;
- `revision`.

The diagnostics facade emits bounded metadata only. Common SG Observability redaction remains active before persistence, while history before/after values are additionally recursively redacted by the facade for secret-shaped keys.

### 8. Module boundary
`src/telegramWorkspace/index.js` exports:
- `createTelegramWorkspaceDiagnosticsObservabilityService`;
- `TELEGRAM_WORKSPACE_DIAGNOSTICS_CONTRACT_VERSION`.

The service composes existing TWM workspace store, authority resolver, configuration service, bot capability service and common SG Observability. It does not introduce a second Telegram transport, authorization system, Action Gate, configuration owner or persistence stack.

## Tests
New deterministic suite:
- `tests/telegramWorkspaceManager1AuditDiagnosticsObservability.test.js`.

Covered cases:
1. authorized actor/time/before/after audit history;
2. secret-shaped history redaction;
3. rollback delegates to the existing protected rollback path unchanged;
4. healthy diagnostics aggregation;
5. configuration success/failure and denial counters;
6. last successful/failed mutation summaries;
7. trace/request propagation into telemetry;
8. no secret leakage in diagnostics telemetry;
9. degraded bot-permission diagnostics with actionable missing permission;
10. fail-closed diagnostics authority denial before disclosure.

Existing TWM1.6/TWM1.7/PostgreSQL suites continue to verify the actual new-version rollback, append-only config history, authorization, Action Gate and atomic persistence semantics.

## CI evidence
Implementation HEAD `f41328b9216cca794a298df100002875178f3c2b` completed **SG 2.1 CI #7376 — SUCCESS**.

The CI foundation job included the repository-wide `npm run check`, Block 19 security gate, migration preflight/apply, Render web startup smoke, Render worker startup smoke and diagnostics startup verification.

## Closure rule
TWM1.11 must not be announced externally as CLOSED until:
1. architecture, roadmap and workflow status documents are synchronized to the implemented contract;
2. the resulting documentation-synchronized closure HEAD completes the full SG 2.1 CI with SUCCESS.
