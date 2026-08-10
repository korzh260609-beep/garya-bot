import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecurityOperationsConfig, createSecurityOperations, redactOperationalData, scanTextForSecrets, verifyBackupRestore } from '../src/operations/securityOperations.js';

function clockSequence(...times) {
  let index = 0;
  return () => new Date(times[Math.min(index++, times.length - 1)]);
}

test('Block 19 rate limiting is bounded by transport, identity and network', () => {
  const config = createSecurityOperationsConfig({ SG_RATE_LIMIT_WINDOW_MS: '1000', SG_RATE_LIMIT_IDENTITY_MAX: '2', SG_RATE_LIMIT_TRANSPORT_MAX: '10', SG_RATE_LIMIT_NETWORK_MAX: '10' });
  const ops = createSecurityOperations({ config, clock: () => new Date('2026-08-10T05:00:00.000Z') });
  assert.equal(ops.checkRateLimit({ transport: 'telegram', globalUserId: 'usr_a', networkId: 'net-1' }).allowed, true);
  assert.equal(ops.checkRateLimit({ transport: 'telegram', globalUserId: 'usr_a', networkId: 'net-1' }).allowed, true);
  const denied = ops.checkRateLimit({ transport: 'telegram', globalUserId: 'usr_a', networkId: 'net-1' });
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterMs > 0);
});

test('Block 19 rate window recovers after expiry', () => {
  const config = createSecurityOperationsConfig({ SG_RATE_LIMIT_WINDOW_MS: '1000', SG_RATE_LIMIT_IDENTITY_MAX: '1' });
  const ops = createSecurityOperations({ config, clock: clockSequence('2026-08-10T05:00:00.000Z','2026-08-10T05:00:00.100Z','2026-08-10T05:00:02.000Z') });
  assert.equal(ops.checkRateLimit({ globalUserId: 'usr_a' }).allowed, true);
  assert.equal(ops.checkRateLimit({ globalUserId: 'usr_a' }).allowed, false);
  assert.equal(ops.checkRateLimit({ globalUserId: 'usr_a' }).allowed, true);
});

test('Block 19 emergency controls fail closed for disabled operational classes', () => {
  const ops = createSecurityOperations({ config: createSecurityOperationsConfig({ SG_AI_EMERGENCY_DISABLED: 'true', SG_AUTOMATION_EMERGENCY_DISABLED: 'true', SG_PROTECTED_CAPABILITIES_EMERGENCY_DISABLED: 'true', SG_TELEGRAM_INGRESS_DISABLED: 'true' }) });
  assert.deepEqual(ops.emergencyState(), { aiDisabled: true, automationDisabled: true, protectedCapabilitiesDisabled: true, telegramIngressDisabled: true });
  assert.equal(ops.permits('ai'), false);
  assert.equal(ops.permits('automation'), false);
  assert.equal(ops.permits('protected-capability'), false);
  assert.equal(ops.permits('telegram-ingress'), false);
  assert.equal(ops.permits('read-only'), true);
});

test('Block 19 secret scanner and operational redaction remove credential-shaped values', () => {
  const token = 'sk-abcdefghijklmnopqrstuvwxyz1234567890';
  assert.equal(scanTextForSecrets(`key=${token}`).clean, false);
  const redacted = redactOperationalData({ apiKey: token, nested: { message: `postgres://user:pass@example/db`, safe: 'ok' } });
  assert.equal(redacted.apiKey, '[REDACTED]');
  assert.equal(redacted.nested.message, '[REDACTED]');
  assert.equal(redacted.nested.safe, 'ok');
});

test('Block 19 alerting identifies actionable error and owner-security denial classes', () => {
  const ops = createSecurityOperations({ config: createSecurityOperationsConfig({ SG_ALERT_ERROR_THRESHOLD: '2', SG_ALERT_SECURITY_DENIAL_THRESHOLD: '2' }) });
  assert.equal(ops.recordFailure({ category: 'error' }).alert, false);
  assert.equal(ops.recordFailure({ category: 'error' }).alert, true);
  assert.equal(ops.recordFailure({ category: 'security-denial' }).alert, false);
  const security = ops.recordFailure({ category: 'security-denial' });
  assert.equal(security.alert, true);
  assert.equal(security.category, 'security-denial');
});

test('Block 19 posture audit requires owner security, validated self knowledge, backup, dependency audit and readiness', () => {
  const ops = createSecurityOperations();
  const bad = ops.auditPosture({ ownerSecurity: { configured: false, lockdown: false }, selfKnowledge: { validationStatus: 'stale' }, secretsRedacted: false, backupVerified: false, dependencyAudit: 'unknown', runtimeReady: false });
  assert.equal(bad.ok, false);
  assert.ok(bad.findings.includes('owner-security-unconfigured'));
  assert.ok(bad.findings.includes('self-knowledge-not-validated'));
  assert.ok(bad.findings.includes('backup-restore-unverified'));
  const good = ops.auditPosture({ ownerSecurity: { configured: true, lockdown: false }, selfKnowledge: { validationStatus: 'valid' }, secretsRedacted: true, backupVerified: true, dependencyAudit: 'pass', runtimeReady: true });
  assert.equal(good.ok, true);
  assert.deepEqual(good.findings, []);
});

test('Block 19 retention policy is explicit, time bounded and owner authorized', () => {
  const ops = createSecurityOperations({ config: createSecurityOperationsConfig({ SG_DATA_RETENTION_DAYS: '30' }), clock: () => new Date('2026-08-10T00:00:00.000Z') });
  const policy = ops.retentionPolicy();
  assert.equal(policy.retentionDays, 30);
  assert.equal(policy.requiresOwnerAuthorization, true);
  assert.equal(policy.exportBeforeDeleteSupported, true);
  assert.equal(policy.deleteBefore, '2026-07-11T00:00:00.000Z');
});

test('Block 19 backup restoration verifies content fingerprint equality', async () => {
  const source = { users: [{ id: 'usr_a' }], tasks: [{ id: 't1', status: 'queued' }] };
  const result = await verifyBackupRestore({
    createBackup: async () => structuredClone(source),
    restoreBackup: async (backup) => structuredClone(backup),
    fingerprint: async (value) => JSON.stringify(value)
  });
  assert.equal(result.verified, true);
  assert.equal(result.before, result.after);
});
