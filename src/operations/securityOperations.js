const SECRET_KEY = /(?:token|secret|password|api[_-]?key|private[_-]?key|credential)/i;
const SECRET_VALUE = /(?:sk-[A-Za-z0-9_-]{20,}|\b\d{6,12}:[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@)/i;

function integer(value, fallback, name, min = 1) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < min) throw new TypeError(`${name} must be an integer >= ${min}`);
  return parsed;
}
function bool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1','true','yes','on'].includes(normalized)) return true;
  if (['0','false','no','off'].includes(normalized)) return false;
  throw new TypeError('operational boolean configuration must be true or false');
}
function clean(value) { return value == null ? '' : String(value).trim(); }
function nowIso(clock) { return clock().toISOString(); }

export function createSecurityOperationsConfig(env = process.env) {
  return Object.freeze({
    rateWindowMs: integer(env.SG_RATE_LIMIT_WINDOW_MS, 60_000, 'SG_RATE_LIMIT_WINDOW_MS'),
    identityMaxRequests: integer(env.SG_RATE_LIMIT_IDENTITY_MAX, 120, 'SG_RATE_LIMIT_IDENTITY_MAX'),
    transportMaxRequests: integer(env.SG_RATE_LIMIT_TRANSPORT_MAX, 600, 'SG_RATE_LIMIT_TRANSPORT_MAX'),
    networkMaxRequests: integer(env.SG_RATE_LIMIT_NETWORK_MAX, 240, 'SG_RATE_LIMIT_NETWORK_MAX'),
    maxHttpBodyBytes: integer(env.SG_MAX_HTTP_BODY_BYTES, 1_048_576, 'SG_MAX_HTTP_BODY_BYTES'),
    errorAlertThreshold: integer(env.SG_ALERT_ERROR_THRESHOLD, 5, 'SG_ALERT_ERROR_THRESHOLD'),
    denialAlertThreshold: integer(env.SG_ALERT_SECURITY_DENIAL_THRESHOLD, 5, 'SG_ALERT_SECURITY_DENIAL_THRESHOLD'),
    retentionDays: integer(env.SG_DATA_RETENTION_DAYS, 90, 'SG_DATA_RETENTION_DAYS'),
    aiDisabled: bool(env.SG_AI_EMERGENCY_DISABLED, false),
    automationDisabled: bool(env.SG_AUTOMATION_EMERGENCY_DISABLED, false),
    protectedCapabilitiesDisabled: bool(env.SG_PROTECTED_CAPABILITIES_EMERGENCY_DISABLED, false),
    telegramIngressDisabled: bool(env.SG_TELEGRAM_INGRESS_DISABLED, false)
  });
}

export function createSecurityOperations({ config = createSecurityOperationsConfig({}), observability = null, clock = () => new Date() } = {}) {
  const buckets = new Map();
  const counters = new Map();

  function consume(key, limit) {
    const now = clock().getTime();
    const previous = buckets.get(key) ?? [];
    const active = previous.filter((timestamp) => now - timestamp < config.rateWindowMs);
    const allowed = active.length < limit;
    if (allowed) active.push(now);
    buckets.set(key, active);
    return Object.freeze({ allowed, remaining: Math.max(0, limit - active.length), retryAfterMs: allowed || active.length === 0 ? 0 : Math.max(1, config.rateWindowMs - (now - active[0])) });
  }

  function emit(eventClass, outcome, data = {}) {
    if (!observability?.record) return;
    const correlation = `operations:${eventClass}:${clock().getTime()}`;
    observability.record({
      eventClass: 'audit_event', channel: eventClass.includes('alert') ? 'telemetry' : 'audit', stage: 'security-operations', outcome,
      traceContext: { traceId: correlation, requestId: correlation, environment: data.environment ?? 'unknown', revision: data.revision ?? 'unknown' },
      data: { operationsEventClass: eventClass, ...data }
    });
  }

  function increment(name) {
    const value = (counters.get(name) ?? 0) + 1;
    counters.set(name, value);
    return value;
  }

  return Object.freeze({
    config,
    checkRateLimit({ transport = 'unknown', globalUserId = null, networkId = null } = {}) {
      const decisions = [consume(`transport:${clean(transport) || 'unknown'}`, config.transportMaxRequests)];
      if (globalUserId) decisions.push(consume(`identity:${clean(globalUserId)}`, config.identityMaxRequests));
      if (networkId) decisions.push(consume(`network:${clean(networkId)}`, config.networkMaxRequests));
      const denied = decisions.find((item) => !item.allowed);
      const result = Object.freeze({ allowed: !denied, retryAfterMs: denied?.retryAfterMs ?? 0, transport: clean(transport) || 'unknown', identityBound: Boolean(globalUserId), networkBound: Boolean(networkId) });
      if (!result.allowed) emit('operations_rate_limit_denied', 'deny', { transport: result.transport, identityBound: result.identityBound, networkBound: result.networkBound });
      return result;
    },
    emergencyState() {
      return Object.freeze({ aiDisabled: config.aiDisabled, automationDisabled: config.automationDisabled, protectedCapabilitiesDisabled: config.protectedCapabilitiesDisabled, telegramIngressDisabled: config.telegramIngressDisabled });
    },
    permits(kind) {
      if (kind === 'ai') return !config.aiDisabled;
      if (kind === 'automation') return !config.automationDisabled;
      if (kind === 'protected-capability') return !config.protectedCapabilitiesDisabled;
      if (kind === 'telegram-ingress') return !config.telegramIngressDisabled;
      return true;
    },
    recordFailure({ category = 'error', environment = 'unknown', revision = 'unknown' } = {}) {
      const key = category === 'security-denial' ? 'security-denial' : 'error';
      const count = increment(key);
      const threshold = key === 'security-denial' ? config.denialAlertThreshold : config.errorAlertThreshold;
      const alert = count >= threshold;
      if (alert) emit('operations_alert', 'triggered', { category: key, count, threshold, environment, revision });
      return Object.freeze({ category: key, count, threshold, alert });
    },
    resetAlertCounters() { counters.clear(); },
    auditPosture({ ownerSecurity, selfKnowledge, secretsRedacted = true, backupVerified = false, dependencyAudit = 'unknown', runtimeReady = false } = {}) {
      const findings = [];
      if (!ownerSecurity?.configured) findings.push('owner-security-unconfigured');
      if (ownerSecurity?.lockdown) findings.push('security-lockdown-active');
      if (!selfKnowledge || !['valid','consistent'].includes(selfKnowledge.validationStatus)) findings.push('self-knowledge-not-validated');
      if (!secretsRedacted) findings.push('secret-redaction-unverified');
      if (!backupVerified) findings.push('backup-restore-unverified');
      if (!['pass','clean'].includes(dependencyAudit)) findings.push('dependency-audit-unverified');
      if (!runtimeReady) findings.push('runtime-not-ready');
      return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings), checkedAt: nowIso(clock) });
    },
    retentionPolicy() { return Object.freeze({ retentionDays: config.retentionDays, deleteBefore: new Date(clock().getTime() - config.retentionDays * 86_400_000).toISOString(), requiresOwnerAuthorization: true, exportBeforeDeleteSupported: true }); }
  });
}

export function redactOperationalData(value) {
  if (Array.isArray(value)) return value.map(redactOperationalData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : redactOperationalData(item)]));
  if (typeof value === 'string' && SECRET_VALUE.test(value)) return '[REDACTED]';
  return value;
}

export function scanTextForSecrets(text) {
  const source = String(text ?? '');
  const matches = [];
  if (SECRET_VALUE.test(source)) matches.push('credential-shaped-value');
  return Object.freeze({ clean: matches.length === 0, findings: Object.freeze(matches) });
}

export async function verifyBackupRestore({ createBackup, restoreBackup, fingerprint } = {}) {
  if (typeof createBackup !== 'function' || typeof restoreBackup !== 'function' || typeof fingerprint !== 'function') throw new TypeError('backup, restore and fingerprint functions are required');
  const backup = await createBackup();
  const before = await fingerprint(backup);
  const restored = await restoreBackup(backup);
  const after = await fingerprint(restored);
  return Object.freeze({ verified: before === after, before, after });
}
