import { isCanonicalGlobalUserId } from '../identity/globalUserId.js';

const DEFAULT_OWNER_ONLY_CAPABILITIES = Object.freeze([
  'system-config-update',
  'security-policy-update',
  'access-admin',
  'identity-admin',
  'ai-provider-admin',
  'connection-admin',
  'feature-flag-admin',
  'system-automation-admin',
  'repository-admin',
  'deployment-admin',
  'database-admin',
  'secret-admin'
]);

function clean(value) { return value == null ? '' : String(value).trim(); }
function bool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (value === true || value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
  if (value === false || value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  throw new TypeError('security boolean configuration must be true or false');
}
function positiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new TypeError(`${name} must be a positive integer`);
  return parsed;
}

export function createOwnerSecurityConfig(env = process.env) {
  const monarchGlobalUserId = clean(env.SG_MONARCH_GLOBAL_USER_ID ?? env.MONARCH_GLOBAL_USER_ID);
  if (monarchGlobalUserId && !isCanonicalGlobalUserId(monarchGlobalUserId)) {
    throw new TypeError('MONARCH_GLOBAL_USER_ID must be a canonical usr_ global user id');
  }
  return Object.freeze({
    monarchGlobalUserId: monarchGlobalUserId || null,
    lockdown: bool(env.SECURITY_LOCKDOWN ?? env.SG_SECURITY_LOCKDOWN, false),
    failureWindowMs: positiveInteger(env.SG_SECURITY_FAILURE_WINDOW_MS, 60000, 'SG_SECURITY_FAILURE_WINDOW_MS'),
    maxFailuresPerWindow: positiveInteger(env.SG_SECURITY_MAX_FAILURES_PER_WINDOW, 10, 'SG_SECURITY_MAX_FAILURES_PER_WINDOW')
  });
}

export function createSecurityPolicyRegistry({ ownerOnlyCapabilities = DEFAULT_OWNER_ONLY_CAPABILITIES } = {}) {
  const ownerOnly = new Set(ownerOnlyCapabilities.map((value) => clean(value)).filter(Boolean));
  return Object.freeze({
    policyId: 'sg-owner-security-policy-v1',
    classify(actionRequest) {
      if (!actionRequest?.capability) throw new TypeError('validated actionRequest is required');
      const capability = clean(actionRequest.capability);
      const protectedOwnerOperation = ownerOnly.has(capability)
        || actionRequest.payload?.ownerOnly === true
        || actionRequest.payload?.securityClass === 'owner-only';
      return Object.freeze({
        policyId: 'sg-owner-security-policy-v1',
        ownerOnly: protectedOwnerOperation,
        capability,
        actionType: clean(actionRequest.actionType),
        actionClass: clean(actionRequest.actionClass)
      });
    },
    isOwnerOnlyCapability(name) { return ownerOnly.has(clean(name)); },
    listOwnerOnlyCapabilities() { return Object.freeze([...ownerOnly].sort()); }
  });
}

export function createOwnerSecurityGateway({
  config = createOwnerSecurityConfig({}),
  policyRegistry = createSecurityPolicyRegistry(),
  observability = null,
  environment = 'unknown',
  revision = 'unknown',
  clock = () => new Date()
} = {}) {
  if (!policyRegistry?.classify) throw new TypeError('security policy registry is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');
  const failures = new Map();

  function failureCount(actorGlobalUserId, nowMs) {
    const previous = failures.get(actorGlobalUserId) ?? [];
    const active = previous.filter((timestamp) => nowMs - timestamp < config.failureWindowMs);
    failures.set(actorGlobalUserId, active);
    return active.length;
  }
  function recordFailure(actorGlobalUserId, nowMs) {
    const count = failureCount(actorGlobalUserId, nowMs);
    const active = failures.get(actorGlobalUserId);
    active.push(nowMs);
    return count + 1;
  }
  function emit(decision, actionRequest) {
    if (!observability?.record) return;
    const trace = actionRequest.traceContext ?? {};
    observability.record({
      eventClass: 'audit_event',
      channel: 'audit',
      stage: 'owner-security',
      outcome: decision.allowed ? 'allow' : 'deny',
      reason: decision.reason,
      traceContext: {
        traceId: trace.traceId,
        requestId: trace.requestId,
        environment: trace.environment ?? environment,
        revision: trace.revision ?? revision
      },
      actorRef: decision.actorGlobalUserId,
      data: {
        securityEventClass: decision.allowed ? 'owner_security_allowed' : 'owner_security_denied',
        policyId: decision.policyId,
        ownerOnly: decision.ownerOnly,
        ownerVerified: decision.ownerVerified,
        lockdown: decision.lockdown,
        capability: decision.capability,
        actionType: decision.actionType,
        projectScope: decision.projectScope,
        failureCount: decision.failureCount
      }
    });
  }

  return Object.freeze({
    name: 'sg-owner-security-gateway-v1',
    evaluate(actionRequest) {
      if (!actionRequest?.actor?.globalUserId || !actionRequest?.scope?.projectScope || !actionRequest?.traceContext) {
        throw new TypeError('validated actionRequest with actor, scope and trace is required');
      }
      const classification = policyRegistry.classify(actionRequest);
      const actorGlobalUserId = clean(actionRequest.actor.globalUserId);
      const nowMs = clock().getTime();
      const ownerConfigured = Boolean(config.monarchGlobalUserId);
      const ownerVerified = ownerConfigured && actorGlobalUserId === config.monarchGlobalUserId;
      const currentFailures = failureCount(actorGlobalUserId, nowMs);
      const rateLimited = classification.ownerOnly && currentFailures >= config.maxFailuresPerWindow;
      let allowed = true;
      let reason = 'not-owner-sensitive';

      if (classification.ownerOnly) {
        if (!ownerConfigured) { allowed = false; reason = 'owner-identity-unconfigured'; }
        else if (rateLimited) { allowed = false; reason = 'owner-security-rate-limited'; }
        else if (!ownerVerified) { allowed = false; reason = 'owner-identity-mismatch'; }
        else if (config.lockdown) { allowed = false; reason = 'security-lockdown'; }
        else { allowed = true; reason = 'verified-owner'; }
      }

      const failureCountAfter = allowed || !classification.ownerOnly ? currentFailures : recordFailure(actorGlobalUserId, nowMs);
      const decision = Object.freeze({
        policyId: classification.policyId,
        ownerOnly: classification.ownerOnly,
        allowed,
        reason,
        ownerConfigured,
        ownerVerified,
        lockdown: config.lockdown,
        actorGlobalUserId,
        projectScope: actionRequest.scope.projectScope,
        capability: classification.capability,
        actionType: classification.actionType,
        failureCount: failureCountAfter,
        evaluatedAt: new Date(nowMs).toISOString()
      });
      emit(decision, actionRequest);
      return decision;
    },
    isVerifiedOwner(globalUserId) {
      return Boolean(config.monarchGlobalUserId) && clean(globalUserId) === config.monarchGlobalUserId;
    },
    status() {
      return Object.freeze({ configured: Boolean(config.monarchGlobalUserId), lockdown: config.lockdown, policyId: policyRegistry.policyId });
    }
  });
}

export { DEFAULT_OWNER_ONLY_CAPABILITIES };
