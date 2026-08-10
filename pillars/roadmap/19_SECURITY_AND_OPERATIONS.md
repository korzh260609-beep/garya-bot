# Block 19 — Security and Operations

## Status
Implemented. Final acceptance requires the branch CI run containing the Block 19 code, security gate and evidence to pass.

## Goal
Prepare SG 2.1 for controlled pilot use with executable operational safeguards around the already-completed identity, authority, owner-security, Self Knowledge, persistence, delivery, diagnostics and E2E foundations.

Block 19 does not create a second authorization model. Identity, Access, Resource Authority, Owner Security and Action Gate remain authoritative.

## Implemented safeguards

### Rate limiting
`src/operations/securityOperations.js` provides bounded window policies for:
- global identity;
- transport;
- network ingress.

Telegram production ingress consumes the transport/network limiter before parsing or executing an update. Rate-limit denial returns HTTP 429 with a bounded `Retry-After` value and no request payload reflection.

### Webhook and endpoint hardening
`src/telegram/telegramWebhookHttpHandler.js` now enforces:
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
The operational posture checker requires positive evidence for:
- canonical owner-security configuration;
- no active owner-security lockdown for normal operation;
- valid/consistent Self Knowledge;
- secret-redaction verification;
- backup/restore verification;
- dependency audit result;
- runtime readiness.

It reports explicit finding codes instead of inventing health.

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

Operational production procedure:
1. create a PostgreSQL backup/snapshot using the managed database backup facility or `pg_dump` in a controlled environment;
2. restore into an isolated recovery database;
3. run migrations only when required by the exact recovery revision;
4. compare required row/object counts plus application-level fingerprints;
5. run `npm run check` and the Block 18/19 verification suites against the recovered database;
6. never overwrite the primary database during a verification restore.

### AI cost / emergency controls
Existing Block 15 role cost limits and AI emergency disable remain authoritative. Block 19 operational state additionally exposes AI emergency-disable posture alongside automation, protected-capability and Telegram ingress states.

### Automation emergency disable
`src/automation/workerEntrypoint.js` now honors `SG_AUTOMATION_EMERGENCY_DISABLED=true` in normal operation and exits cleanly without claiming queued work. CI verification mode remains executable so the safety mechanism itself can be tested.

### Feature flags and protected capabilities
Block 16.16 kill switches remain the runtime controlled-rollout mechanism. Owner Security `SECURITY_LOCKDOWN` remains the owner-sensitive emergency lock. Block 19 does not let a feature flag grant missing permission, authority or Action Gate approval.

### Alerts
The operational alert counter distinguishes at least:
- runtime/error failures;
- owner/security denials.

Threshold crossings emit an explicit actionable alert class through observability when configured with an observability service.

### Incident response
Canonical response sequence:
1. identify the failure class from diagnostics/alerts;
2. preserve trace/revision evidence;
3. enable the narrowest applicable emergency control (AI, automation, Telegram ingress, feature kill switch, or `SECURITY_LOCKDOWN`);
4. do not modify identity/authority data to work around an incident;
5. verify secrets are not present in telemetry;
6. recover the failed dependency or rollback deployment;
7. run Block 18 + Block 19 verification before reopening the affected capability;
8. document root cause and regression coverage.

### Dependency/vulnerability process
Every CI run before pilot performs production dependency vulnerability audit. High-or-greater audit failure blocks CI. Dependency changes must preserve lockfile determinism and pass the complete CI suite.

## Configuration
Optional operational inputs (validated defaults exist):

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
SG_PROTECTED_CAPABILITIES_EMERGENCY_DISABLED=false
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

Primary tests:
- `tests/securityOperations.test.js`;
- `tests/telegramWebhookSecurity.test.js`;
- existing Owner Security, Feature Flags, Secrets, Diagnostics, Render, Worker and Block 18 E2E suites.

## Acceptance criteria
- [x] guests remain unable to obtain owner authority through the operational layer;
- [x] non-owner actors cannot alter SG-wide owner/security authority state through Block 19;
- [x] sensitive credential-shaped values are scanned/redacted by operational tooling and existing observability boundaries remain secret-safe;
- [x] emergency AI/automation/Telegram/owner-security/feature controls have explicit fail-closed behavior;
- [x] backup→restore fingerprint verification is executable and tested;
- [x] alerts classify actionable error and security-denial classes;
- [x] rate limiting and webhook hardening are executable and tested;
- [x] data retention/export/deletion policy is explicit and owner-authorized;
- [x] incident-response and dependency-update procedures are documented;
- [x] production dependency and secret checks are mandatory CI gates before pilot;
- [ ] final branch CI containing all Block 19 changes is successful.

## Completion rule
Do not mark Block 19 completed from documentation alone. Mark it Completed only after GitHub Actions passes the final Block 19 HEAD with `Block 19 security gate`, full tests, runtime startup, worker verification and diagnostics verification all successful.
