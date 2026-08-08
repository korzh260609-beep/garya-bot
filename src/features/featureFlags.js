import { createHash } from 'node:crypto';

const TARGET_KINDS = Object.freeze(['global','environment','project','role','user','resource','cohort','percentage']);
const SECURITY_MODES = Object.freeze(['fail-closed','normal']);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function clone(value) { return value == null ? value : structuredClone(value); }
function bool(value, name) { if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`); return value; }
function intRange(value, min, max, name) { const n = Number(value); if (!Number.isInteger(n) || n < min || n > max) throw new TypeError(`${name} must be integer ${min}..${max}`); return n; }
function freeze(value) { return Object.freeze(clone(value)); }
function normalizeRoles(value = []) { return Object.freeze([...new Set(value.map((v) => required(v,'role')))].sort()); }

export function stableBucket({ featureId, subjectKey, salt = 'sg2.1-feature-flags-v1' }) {
  const digest = createHash('sha256').update(`${salt}|${required(featureId,'featureId')}|${required(subjectKey,'subjectKey')}`).digest();
  return digest.readUInt32BE(0) % 10000;
}

export function createInMemoryFeatureFlagStore() {
  const flags = new Map();
  return Object.freeze({
    async upsert(flag) { flags.set(flag.featureId, freeze(flag)); return freeze(flag); },
    async get(featureId) { return clone(flags.get(featureId) ?? null); },
    async list() { return [...flags.values()].map(clone).sort((a,b) => a.featureId.localeCompare(b.featureId)); },
    async remove(featureId) { return flags.delete(featureId); }
  });
}

export function normalizeFeatureFlag(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('feature flag input is required');
  const featureId = required(input.featureId,'featureId');
  const enabled = bool(input.enabled ?? false,'enabled');
  const killSwitch = bool(input.killSwitch ?? false,'killSwitch');
  const securityMode = input.securityMode ?? 'fail-closed';
  if (!SECURITY_MODES.includes(securityMode)) throw new TypeError('unsupported securityMode');
  const percentage = intRange(input.percentage ?? 10000, 0, 10000, 'percentage');
  const expiresAt = optional(input.expiresAt);
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) throw new TypeError('expiresAt must be valid timestamp');
  const reviewAt = optional(input.reviewAt);
  if (reviewAt && Number.isNaN(new Date(reviewAt).getTime())) throw new TypeError('reviewAt must be valid timestamp');
  return Object.freeze({
    featureId,
    enabled,
    killSwitch,
    securityMode,
    environments: Object.freeze([...new Set((input.environments ?? []).map(v => required(v,'environment')))].sort()),
    projects: Object.freeze([...new Set((input.projects ?? []).map(v => required(v,'project')))].sort()),
    roles: normalizeRoles(input.roles),
    users: Object.freeze([...new Set((input.users ?? []).map(v => required(v,'user')))].sort()),
    resources: Object.freeze([...new Set((input.resources ?? []).map(v => required(v,'resource')))].sort()),
    cohorts: Object.freeze([...new Set((input.cohorts ?? []).map(v => required(v,'cohort')))].sort()),
    percentage,
    expiresAt,
    reviewAt,
    temporary: bool(input.temporary ?? false,'temporary'),
    metadata: freeze(input.metadata ?? {}),
    version: required(input.version ?? '1.0','version')
  });
}

export function createFeatureFlagService({
  store = createInMemoryFeatureFlagStore(),
  clock = () => new Date(),
  observability = null,
  policyResolver = null
} = {}) {
  async function observe(eventType, decision) {
    if (!observability?.record) return;
    await observability.record({ eventClass: 'system_event', eventType, channel: 'telemetry', stage: 'feature-flags', traceContext: decision.traceContext ?? null, outcome: decision.enabled ? 'enabled' : 'disabled', reason: null, data: {
      featureId: decision.featureId, enabled: decision.enabled, source: decision.source, reasonCode: decision.reasonCode,
      bucket: decision.bucket ?? null, percentage: decision.percentage ?? null,
      projectScope: decision.context?.projectScope ?? null, globalUserId: decision.context?.globalUserId ?? null,
      resourceId: decision.context?.resourceId ?? null
    }});
  }

  async function setFlag(input) {
    const flag = normalizeFeatureFlag(input);
    if (flag.temporary && !flag.expiresAt && !flag.reviewAt) throw new TypeError('temporary flags require expiresAt or reviewAt');
    return store.upsert(flag);
  }

  async function resolve(featureId, context = {}) {
    const id = required(featureId,'featureId');
    const flag = await store.get(id);
    const now = clock();
    const normalizedContext = Object.freeze({
      environment: optional(context.environment),
      projectScope: optional(context.projectScope),
      globalUserId: optional(context.globalUserId),
      roles: normalizeRoles(context.roles ?? []),
      resourceId: optional(context.resourceId),
      cohorts: Object.freeze([...new Set((context.cohorts ?? []).map(v => required(v,'cohort')))].sort()),
      subjectKey: optional(context.subjectKey) ?? optional(context.globalUserId) ?? optional(context.resourceId) ?? optional(context.projectScope) ?? 'anonymous',
      permissionSatisfied: context.permissionSatisfied === true,
      authoritySatisfied: context.authoritySatisfied !== false,
      actionGateSatisfied: context.actionGateSatisfied !== false
    });

    const base = { featureId: id, context: normalizedContext, traceContext: context.traceContext ?? null };
    if (!flag) {
      const decision = Object.freeze({ ...base, enabled: false, source: 'default', reasonCode: 'flag-missing', bucket: null, percentage: null });
      await observe('feature_flag_resolved', decision); return decision;
    }
    if (flag.killSwitch) {
      const decision = Object.freeze({ ...base, enabled: false, source: 'kill-switch', reasonCode: 'killed', bucket: null, percentage: flag.percentage });
      await observe('feature_flag_resolved', decision); return decision;
    }
    if (flag.expiresAt && now >= new Date(flag.expiresAt)) {
      const decision = Object.freeze({ ...base, enabled: false, source: 'expiry', reasonCode: 'expired', bucket: null, percentage: flag.percentage });
      await observe('feature_flag_resolved', decision); return decision;
    }
    if (!flag.enabled) {
      const decision = Object.freeze({ ...base, enabled: false, source: 'flag', reasonCode: 'disabled', bucket: null, percentage: flag.percentage });
      await observe('feature_flag_resolved', decision); return decision;
    }

    if (policyResolver) {
      const policy = await policyResolver({ featureId: id, context: normalizedContext, flag });
      if (policy?.enabled === false) {
        const decision = Object.freeze({ ...base, enabled: false, source: 'configuration-policy', reasonCode: policy.reasonCode ?? 'policy-disabled', bucket: null, percentage: flag.percentage });
        await observe('feature_flag_resolved', decision); return decision;
      }
    }

    if (flag.environments.length && !flag.environments.includes(normalizedContext.environment)) return finalize(false,'environment','environment-not-targeted');
    if (flag.projects.length && !flag.projects.includes(normalizedContext.projectScope)) return finalize(false,'project','project-not-targeted');
    if (flag.roles.length && !flag.roles.some(role => normalizedContext.roles.includes(role))) return finalize(false,'role','role-not-targeted');
    if (flag.users.length && !flag.users.includes(normalizedContext.globalUserId)) return finalize(false,'user','user-not-targeted');
    if (flag.resources.length && !flag.resources.includes(normalizedContext.resourceId)) return finalize(false,'resource','resource-not-targeted');
    if (flag.cohorts.length && !flag.cohorts.some(cohort => normalizedContext.cohorts.includes(cohort))) return finalize(false,'cohort','cohort-not-targeted');

    if (!normalizedContext.permissionSatisfied || !normalizedContext.authoritySatisfied || !normalizedContext.actionGateSatisfied) {
      return finalize(false,'authorization-boundary','authorization-not-satisfied');
    }

    if (flag.percentage < 10000) {
      const bucket = stableBucket({ featureId: id, subjectKey: normalizedContext.subjectKey });
      const decision = Object.freeze({ ...base, enabled: bucket < flag.percentage, source: 'percentage', reasonCode: bucket < flag.percentage ? 'bucket-included' : 'bucket-excluded', bucket, percentage: flag.percentage });
      await observe('feature_flag_resolved', decision); return decision;
    }
    return finalize(true,'flag','enabled');

    async function finalize(enabled, source, reasonCode) {
      const decision = Object.freeze({ ...base, enabled, source, reasonCode, bucket: null, percentage: flag.percentage });
      await observe('feature_flag_resolved', decision); return decision;
    }
  }

  async function requireEnabled(featureId, context = {}) {
    const decision = await resolve(featureId, context);
    if (!decision.enabled) {
      const error = new Error(`feature unavailable: ${featureId}`);
      error.code = 'feature-disabled';
      error.featureDecision = decision;
      throw error;
    }
    return decision;
  }

  async function diagnostics() {
    const flags = await store.list();
    const now = clock();
    return Object.freeze(flags.map(flag => Object.freeze({
      featureId: flag.featureId, enabled: flag.enabled, killSwitch: flag.killSwitch, percentage: flag.percentage,
      temporary: flag.temporary, expiresAt: flag.expiresAt, reviewAt: flag.reviewAt,
      expired: Boolean(flag.expiresAt && now >= new Date(flag.expiresAt))
    })));
  }

  return Object.freeze({ setFlag, resolve, requireEnabled, diagnostics, store });
}

export { TARGET_KINDS };
