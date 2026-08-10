# Block 19 — Security and Operations

## Status
Completed and acceptance-verified.

## Goal
Prepare SG 2.1 for controlled pilot use with executable operational safeguards around the already-completed identity, authority, owner-security, Self Knowledge, persistence, delivery, diagnostics and E2E foundations.

Block 19 does not create a second authorization model. Identity, Access, Resource Authority, Owner Security and Action Gate remain authoritative.

## Implemented safeguards

### Rate limiting
`src/operations/securityOperations.js` provides bounded window policies for:
- global identity;
- transport;
- network ingress.

Telegram production ingress consumes the transport/network limiter before parsing or executing an update. Rate-limit denial returns HTTP 429 with a bounded `Retry-After` value and no request payload reflection. Identity limiting is available after canonical `global_user_id` resolution and is not inferred from transport names or message text.

### Webhook and endpoint hardening
`src/telegram/telegramWebhookHttpHandler.js` enforces:
- POST-only webhook access;
- JSON media type;
- bounded request body size;
- no-store responses;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- restrictive CSP;
- bounded ingress rate limiting;
- emergency Telegram ingress disable.

Existing webhook secret verification and durable update deduplication remain authoritative after this boundary.

### Owner/security posture audit
The operational posture checker requires positive evidence for canonical owner-security configuration, valid/consistent Self Knowledge, verified secret redaction, backup/restore verification, dependency audit and runtime readiness. It reports explicit finding codes instead of inventing health.

### Secrets and credentials
Block 19 adds:
- repository source secret-shape scan through `npm run security:scan`;
- recursive operational redaction helper;
- CI production dependency audit through `npm audit --omit=dev --audit-level=high`;
- existing Blocks 16.8/16.9 remain the credential/connection authorities.

### Retention / export / deletion
The operational retention policy is explicit and time-bounded. Deletion is owner-authorized and the contract records that export-before-delete is supported. Production destructive execution remains subject to existing Owner Security and Action Gate controls; Block 19 does not add an unguarded deletion path.

Default retention policy: 90 days unless `SG_DATA_RETENTION_DAYS` is configured.

### Backup and recovery
`verifyBackupRestore()` performs backup → restore → fingerprint equality verification and fails acceptance when restored content differs.

`tests/securityOperationsPostgres.test.js` exercises the recovery contract against the real CI PostgreSQL service: deterministic rows are persisted, snapshotted, removed, restored, fingerprinted and verified in an isolated recovery table. This proves the database recovery path without mutating production data.

Operational production procedure:
1. create a PostgreSQL backup/snapshot using the managed database backup facility or `pg_dump` in a controlled environment;
2. restore into an isolated recovery database;
3. run migrations only when required by the exact recovery revision;
4. compare required row/object counts plus application-level fingerprints;
5. run `npm run check` and the Block 18/19 verification suites against the recovered database;
6. never overwrite the primary database during a verification restore.

### AI cost / emergency controls
Existing Block 15 role cost limits and the already-wired `SG_AI_EMERGENCY_DISABLED` switch remain authoritative for AI execution.

### Automation emergency disable
`src/automation/workerEntrypoint.js` honors `SG_AUTOMATION_EMERGENCY_DISABLED=true` in normal operation and exits cleanly without claiming queued work. CI verification mode remains executable so the worker itself can still be verified.

### Feature flags and protected capabilities
Protected capability shutdown uses mechanisms that are already on the real authorization/execution path: Block 16.16 feature kill switches, Owner Security `SECURITY_LOCKDOWN`, and Action Gate denial. Block 19 deliberately does not introduce a second unused protected-capability flag or bypass path.

### Telegram ingress emergency disable
`SG_TELEGRAM_INGRESS_DISABLED=true` fails closed at the production webhook boundary before update parsing or SG execution.

### Alerts
The operational alert counter distinguishes runtime/error failures and owner/security denials. Threshold crossings emit an explicit actionable alert class through observability when configured with an observability service.

### Incident response
Canonical response sequence:
1. identify the failure class from diagnostics/alerts;
2. preserve trace/revision evidence;
3. enable the narrowest applicable emergency control;
4. do not modify identity/authority data to work around an incident;
5. verify secrets are not present in telemetry;
6. recover the failed dependency or rollback deployment;
7. run Block 18 + Block 19 verification before reopening the affected capability;
8. document root cause and regression coverage.

### Dependency/vulnerability process
Every CI run before pilot performs production dependency vulnerability audit. High-or-greater audit failure blocks CI. Dependency changes must preserve lockfile determinism and pass the complete CI suite.

## Configuration
Optional operational inputs have validated defaults:

```text
SG_RATE_LIMIT_WINDOW_MS=60000
SG_RATE_LIMIT_IDENTITY_MAX=120
SG_RATE_LIMIT_TRANSPORT_MAX=600
SG_RATE_LIMIT_NETWORK_MAX=240
SG_MAX_HTTP_BODY_BYTES=1048576
SG_ALERT_ERROR_THRESHOLD=5
SG_ALERT_SECURITY_DENIAL_THRESHOLD=5
SG_DATA_RETENTION_DAYS=90
SG_AI_EMERGENCY_DISABLED=false
SG_AUTOMATION_EMERGENCY_DISABLED=false
SG_TELEGRAM_INGRESS_DISABLED=false
```

`SECURITY_LOCKDOWN`, Block 15 AI controls and Block 16.16 feature flags remain separate existing controls.

## Executable verification

```bash
npm run test:security-ops
npm run security:scan
npm run security:audit
npm run security:check
npm run check
```

The dedicated security gate includes:
- `tests/securityOperations.test.js`;
- `tests/securityOperationsPostgres.test.js`;
- `tests/telegramWebhookSecurity.test.js`.

The repository-wide suite additionally retains Owner Security, Feature Flags, Secrets, Diagnostics, Render, Worker and Block 18 E2E tests.

## Acceptance criteria
- [x] guests remain unable to obtain owner authority through the operational layer;
- [x] non-owner actors cannot alter SG-wide owner/security authority state through Block 19;
- [x] sensitive credential-shaped values are scanned/redacted by operational tooling and existing observability boundaries remain secret-safe;
- [x] emergency AI/automation/Telegram/owner-security/feature controls have explicit fail-closed behavior on their real execution boundaries;
- [x] PostgreSQL backup→restore fingerprint verification is executable and tested against the CI database;
- [x] alerts classify actionable error and security-denial classes;
- [x] rate limiting and webhook hardening are executable and tested;
- [x] data retention/export/deletion policy is explicit and owner-authorized;
- [x] incident-response and dependency-update procedures are documented;
- [x] production dependency and secret checks are mandatory CI gates before pilot;
- [x] branch CI containing the Block 19 implementation completed successfully before final evidence synchronization.

## Acceptance evidence
Initial complete implementation acceptance: GitHub Actions `SG 2.1 CI` #6901 — SUCCESS.

The final Block 19 HEAD must also pass the same mandatory sequence after PostgreSQL recovery verification and evidence synchronization:
- `npm ci`;
- migrations;
- `Block 19 security gate`;
- `npm run check`;
- runtime startup;
- durable worker verification;
- independent diagnostics service verification.
