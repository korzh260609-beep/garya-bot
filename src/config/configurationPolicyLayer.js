const DEFAULT_POLICY = Object.freeze({
  action: Object.freeze({
    failClosed: true,
    requireConfirmationForProtected: true,
    requireAuthenticatedActor: true,
    allowMonarchWildcard: true,
    maxAutoRisk: 'medium',
    maxAutoCostUsd: 0.05
  }),
  ai: Object.freeze({
    routerOnly: true,
    specializedFirst: true,
    directProviderCallsAllowed: false,
    timeoutMs: 30000,
    maxRetries: 1,
    retryDelayMs: 100
  }),
  capability: Object.freeze({ maxRetries: 5, maxTimeoutMs: 60000 }),
  source: Object.freeze({ requireApprovedSources: true, maxSourcesPerRequest: 20 }),
  autonomy: Object.freeze({ protectedActionsRequireGate: true, maxActionsPerRun: 10, maxDelegationDepth: 3 }),
  automation: Object.freeze({ protectedActionsRequireGate: true, maxRetryAttempts: 3 }),
  delivery: Object.freeze({ requireAuthorizedTarget: true, maxAttempts: 3, maxPayloadBytes: 1000000 }),
  memory: Object.freeze({ strictScopeIsolation: true }),
  repository: Object.freeze({ mutationMode: 'prepare-only' })
});

const POLICY_SCHEMA = Object.freeze({
  'action.failClosed': 'boolean',
  'action.requireConfirmationForProtected': 'boolean',
  'action.requireAuthenticatedActor': 'boolean',
  'action.allowMonarchWildcard': 'boolean',
  'action.maxAutoRisk': ['low', 'medium', 'high', 'critical'],
  'action.maxAutoCostUsd': 'non-negative-number',
  'ai.routerOnly': 'boolean',
  'ai.specializedFirst': 'boolean',
  'ai.directProviderCallsAllowed': 'boolean',
  'ai.timeoutMs': 'positive-integer',
  'ai.maxRetries': 'non-negative-integer',
  'ai.retryDelayMs': 'non-negative-integer',
  'capability.maxRetries': 'non-negative-integer',
  'capability.maxTimeoutMs': 'positive-integer',
  'source.requireApprovedSources': 'boolean',
  'source.maxSourcesPerRequest': 'positive-integer',
  'autonomy.protectedActionsRequireGate': 'boolean',
  'autonomy.maxActionsPerRun': 'positive-integer',
  'autonomy.maxDelegationDepth': 'non-negative-integer',
  'automation.protectedActionsRequireGate': 'boolean',
  'automation.maxRetryAttempts': 'positive-integer',
  'delivery.requireAuthorizedTarget': 'boolean',
  'delivery.maxAttempts': 'positive-integer',
  'delivery.maxPayloadBytes': 'positive-integer',
  'memory.strictScopeIsolation': 'boolean',
  'repository.mutationMode': ['prepare-only', 'disabled']
});

const SAFE_HOT_RELOAD_PATHS = Object.freeze([
  'ai.timeoutMs', 'ai.maxRetries', 'ai.retryDelayMs',
  'capability.maxRetries', 'capability.maxTimeoutMs',
  'source.maxSourcesPerRequest',
  'autonomy.maxActionsPerRun', 'autonomy.maxDelegationDepth',
  'automation.maxRetryAttempts',
  'delivery.maxAttempts', 'delivery.maxPayloadBytes'
]);

const DEFAULT_ROLE_PRECEDENCE = Object.freeze(['guest', 'citizen', 'monarch']);

function clone(value) { return value == null ? value : structuredClone(value); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function flatten(value, prefix = '', output = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('policy layer must be a plain object');
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, output);
    else output[path] = child;
  }
  return output;
}
function setPath(target, path, value) {
  const parts = path.split('.'); let node = target;
  for (const part of parts.slice(0, -1)) node = node[part] ??= {};
  node[parts.at(-1)] = value;
}
function validateValue(path, value) {
  const rule = POLICY_SCHEMA[path];
  if (!rule) throw new TypeError(`unknown policy key: ${path}`);
  if (Array.isArray(rule)) {
    if (!rule.includes(value)) throw new TypeError(`${path} must be one of: ${rule.join(', ')}`);
    return;
  }
  if (rule === 'boolean' && typeof value !== 'boolean') throw new TypeError(`${path} must be boolean`);
  if (rule === 'positive-integer' && (!Number.isInteger(value) || value <= 0)) throw new TypeError(`${path} must be a positive integer`);
  if (rule === 'non-negative-integer' && (!Number.isInteger(value) || value < 0)) throw new TypeError(`${path} must be a non-negative integer`);
  if (rule === 'non-negative-number' && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new TypeError(`${path} must be a finite non-negative number`);
}
function normalizeLayer(layer = {}) {
  const flattened = flatten(layer);
  for (const [path, value] of Object.entries(flattened)) validateValue(path, value);
  const normalized = {};
  for (const [path, value] of Object.entries(flattened)) setPath(normalized, path, clone(value));
  return deepFreeze(normalized);
}
function mergeLayers(layers) {
  const result = {}, provenance = {};
  for (const { name, value } of layers) for (const [path, item] of Object.entries(flatten(value))) { setPath(result, path, clone(item)); provenance[path] = name; }
  return { policy: deepFreeze(result), provenance: deepFreeze(provenance) };
}
function parseBoolean(value, name) {
  if (value == null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new TypeError(`${name} must be boolean`);
}
function parseInteger(value, name, { positive = false } = {}) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || (positive ? parsed <= 0 : parsed < 0)) throw new TypeError(`${name} must be ${positive ? 'a positive' : 'a non-negative'} integer`);
  return parsed;
}
function parseNumber(value, name) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${name} must be a finite non-negative number`);
  return parsed;
}
function compactObject(input) {
  const output = {};
  for (const [section, values] of Object.entries(input)) {
    const kept = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
    if (Object.keys(kept).length) output[section] = kept;
  }
  return output;
}
function roleRank(role, precedence) {
  const index = precedence.indexOf(role);
  return index < 0 ? precedence.length : index;
}

export function createEnvironmentPolicyOverrides(env = {}) {
  return deepFreeze(compactObject({
    action: {
      requireConfirmationForProtected: parseBoolean(env.SG_POLICY_REQUIRE_CONFIRMATION_FOR_PROTECTED, 'SG_POLICY_REQUIRE_CONFIRMATION_FOR_PROTECTED'),
      maxAutoRisk: env.SG_POLICY_MAX_AUTO_RISK || undefined,
      maxAutoCostUsd: parseNumber(env.SG_POLICY_MAX_AUTO_COST_USD, 'SG_POLICY_MAX_AUTO_COST_USD')
    },
    ai: {
      timeoutMs: parseInteger(env.AI_TIMEOUT_MS, 'AI_TIMEOUT_MS', { positive: true }),
      maxRetries: parseInteger(env.AI_MAX_RETRIES, 'AI_MAX_RETRIES'),
      retryDelayMs: parseInteger(env.AI_RETRY_DELAY_MS, 'AI_RETRY_DELAY_MS')
    },
    capability: {
      maxRetries: parseInteger(env.SG_CAPABILITY_MAX_RETRIES, 'SG_CAPABILITY_MAX_RETRIES'),
      maxTimeoutMs: parseInteger(env.SG_CAPABILITY_MAX_TIMEOUT_MS, 'SG_CAPABILITY_MAX_TIMEOUT_MS', { positive: true })
    },
    source: { maxSourcesPerRequest: parseInteger(env.SG_SOURCE_MAX_PER_REQUEST, 'SG_SOURCE_MAX_PER_REQUEST', { positive: true }) },
    autonomy: {
      maxActionsPerRun: parseInteger(env.SG_AUTONOMY_MAX_ACTIONS_PER_RUN, 'SG_AUTONOMY_MAX_ACTIONS_PER_RUN', { positive: true }),
      maxDelegationDepth: parseInteger(env.SG_AUTONOMY_MAX_DELEGATION_DEPTH, 'SG_AUTONOMY_MAX_DELEGATION_DEPTH')
    },
    automation: { maxRetryAttempts: parseInteger(env.SG_AUTOMATION_MAX_RETRY_ATTEMPTS, 'SG_AUTOMATION_MAX_RETRY_ATTEMPTS', { positive: true }) },
    delivery: {
      maxAttempts: parseInteger(env.SG_DELIVERY_MAX_ATTEMPTS, 'SG_DELIVERY_MAX_ATTEMPTS', { positive: true }),
      maxPayloadBytes: parseInteger(env.SG_DELIVERY_MAX_PAYLOAD_BYTES, 'SG_DELIVERY_MAX_PAYLOAD_BYTES', { positive: true })
    }
  }));
}

export function createConfigurationPolicyLayer({ defaults = DEFAULT_POLICY, environment = {}, project = {}, rolePolicies = {}, rolePrecedence = DEFAULT_ROLE_PRECEDENCE } = {}) {
  const normalizedDefaults = normalizeLayer(defaults), normalizedEnvironment = normalizeLayer(environment), normalizedProject = normalizeLayer(project);
  const normalizedRoles = new Map();
  for (const [role, policy] of Object.entries(rolePolicies)) normalizedRoles.set(String(role), normalizeLayer(policy));
  const precedence = Object.freeze([...new Set(rolePrecedence.map(String))]);

  function resolve({ roles = [] } = {}) {
    const normalizedRoleList = [...new Set((roles ?? []).map(String))].sort((a, b) => roleRank(a, precedence) - roleRank(b, precedence) || a.localeCompare(b));
    const layers = [{ name: 'defaults', value: normalizedDefaults }, { name: 'environment', value: normalizedEnvironment }, { name: 'project', value: normalizedProject }];
    for (const role of normalizedRoleList) { const policy = normalizedRoles.get(role); if (policy) layers.push({ name: `role:${role}`, value: policy }); }
    const resolved = mergeLayers(layers);
    return deepFreeze({ ...resolved, roles: Object.freeze(normalizedRoleList) });
  }

  function withSafeHotReload(overrides = {}) {
    const normalized = normalizeLayer(overrides);
    const paths = Object.keys(flatten(normalized));
    const unsafe = paths.filter((path) => !SAFE_HOT_RELOAD_PATHS.includes(path));
    if (unsafe.length) throw new TypeError(`policy hot reload is not allowed for: ${unsafe.join(', ')}`);
    const mergedEnvironment = mergeLayers([{ name: 'current-environment', value: normalizedEnvironment }, { name: 'hot-reload', value: normalized }]).policy;
    return createConfigurationPolicyLayer({ defaults: normalizedDefaults, environment: mergedEnvironment, project: normalizedProject, rolePolicies: Object.fromEntries(normalizedRoles), rolePrecedence: precedence });
  }

  return Object.freeze({ resolve, getSchema: () => POLICY_SCHEMA, withSafeHotReload });
}

export function createDefaultConfigurationPolicyLayer(overrides = {}) { return createConfigurationPolicyLayer(overrides); }
export { DEFAULT_POLICY, POLICY_SCHEMA, SAFE_HOT_RELOAD_PATHS, DEFAULT_ROLE_PRECEDENCE };
