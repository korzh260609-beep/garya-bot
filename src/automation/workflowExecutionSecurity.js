export const WORKFLOW_EXECUTION_SECURITY_CHECKS = Object.freeze([
  'identity',
  'access',
  'resourceAuthority',
  'actionGate',
  'credentials',
  'permissionHealth'
]);

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

const SECURITY_SNAPSHOT_LIMITS = Object.freeze({
  maxDepth: 6,
  maxEntries: 64,
  maxStringLength: 512
});
const SENSITIVE_SNAPSHOT_KEY = /(?:secret|token|password|passphrase|authorization|cookie|api[-_]?key|access[-_]?key|private|credential[-_]?value)/i;
const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';

function normalizeEvidenceRefs(value, field) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${field}.evidenceRefs must be an array`);
  return value.map((item) => String(item));
}

function sanitizeSecuritySnapshot(value, { depth = 0, seen = new WeakSet() } = {}) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.length <= SECURITY_SNAPSHOT_LIMITS.maxStringLength) return value;
    return `${value.slice(0, SECURITY_SNAPSHOT_LIMITS.maxStringLength)}${TRUNCATED}`;
  }
  if (typeof value !== 'object') return String(value);
  if (depth >= SECURITY_SNAPSHOT_LIMITS.maxDepth) return TRUNCATED;
  if (seen.has(value)) return TRUNCATED;
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, SECURITY_SNAPSHOT_LIMITS.maxEntries)
      .map((item) => sanitizeSecuritySnapshot(item, { depth: depth + 1, seen }));
    if (value.length > SECURITY_SNAPSHOT_LIMITS.maxEntries) items.push(TRUNCATED);
    return Object.freeze(items);
  }

  const sanitized = {};
  const entries = Object.entries(value);
  for (const [key, item] of entries.slice(0, SECURITY_SNAPSHOT_LIMITS.maxEntries)) {
    sanitized[key] = SENSITIVE_SNAPSHOT_KEY.test(key)
      ? REDACTED
      : sanitizeSecuritySnapshot(item, { depth: depth + 1, seen });
  }
  if (entries.length > SECURITY_SNAPSHOT_LIMITS.maxEntries) sanitized.truncated = true;
  return Object.freeze(sanitized);
}

function normalizeVerdict(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must return an object`);
  return Object.freeze({
    allowed: value.allowed === true,
    reason: value.reason == null ? null : String(value.reason),
    evidenceRefs: Object.freeze(normalizeEvidenceRefs(value.evidenceRefs, field)),
    snapshot: value.snapshot == null ? null : sanitizeSecuritySnapshot(value.snapshot)
  });
}

export function isProtectedWorkflowStep(step) {
  return step?.security?.protected === true;
}

export function createWorkflowExecutionSecurity({ checks, clock = () => new Date().toISOString() } = {}) {
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) throw new TypeError('checks must be an object');
  const currentChecks = Object.freeze(Object.fromEntries(
    WORKFLOW_EXECUTION_SECURITY_CHECKS.map((name) => [name, requiredFunction(checks[name], `checks.${name}`)])
  ));
  requiredFunction(clock, 'clock');

  async function recheckProtectedStep(context) {
    if (!context || typeof context !== 'object' || Array.isArray(context)) throw new TypeError('execution security context must be an object');
    if (!isProtectedWorkflowStep(context.step)) {
      return Object.freeze({ allowed: true, protected: false, evaluatedAt: clock(), checks: Object.freeze({}), evidenceRefs: Object.freeze([]) });
    }

    const evaluated = {};
    const evidenceRefs = [];
    for (const name of WORKFLOW_EXECUTION_SECURITY_CHECKS) {
      let verdict;
      try {
        verdict = normalizeVerdict(await currentChecks[name](Object.freeze({ ...context })), `checks.${name}`);
      } catch (error) {
        return Object.freeze({
          allowed: false,
          protected: true,
          failedCheck: name,
          reason: `execution-security-${name}-error`,
          errorCode: error?.code == null ? 'execution_security_check_error' : String(error.code),
          errorMessage: error instanceof Error ? error.message : String(error),
          evaluatedAt: clock(),
          checks: Object.freeze({ ...evaluated }),
          evidenceRefs: Object.freeze(evidenceRefs)
        });
      }
      evaluated[name] = verdict;
      evidenceRefs.push(...verdict.evidenceRefs);
      if (!verdict.allowed) {
        return Object.freeze({
          allowed: false,
          protected: true,
          failedCheck: name,
          reason: verdict.reason ?? `execution-security-${name}-denied`,
          errorCode: 'execution_security_denied',
          errorMessage: verdict.reason ?? `execution-time ${name} check denied`,
          evaluatedAt: clock(),
          checks: Object.freeze({ ...evaluated }),
          evidenceRefs: Object.freeze(evidenceRefs)
        });
      }
    }

    return Object.freeze({
      allowed: true,
      protected: true,
      failedCheck: null,
      reason: null,
      evaluatedAt: clock(),
      checks: Object.freeze({ ...evaluated }),
      evidenceRefs: Object.freeze(evidenceRefs)
    });
  }

  return Object.freeze({ recheckProtectedStep });
}
