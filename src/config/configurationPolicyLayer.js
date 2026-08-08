const DEFAULT_POLICY = Object.freeze({
  action: Object.freeze({ failClosed: true, requireConfirmationForProtected: true }),
  automation: Object.freeze({ protectedActionsRequireGate: true, maxRetryAttempts: 3 }),
  memory: Object.freeze({ strictScopeIsolation: true }),
  ai: Object.freeze({ routerOnly: true, specializedFirst: true, directProviderCallsAllowed: false }),
  repository: Object.freeze({ mutationMode: 'prepare-only' })
});

const POLICY_SCHEMA = Object.freeze({
  'action.failClosed': 'boolean',
  'action.requireConfirmationForProtected': 'boolean',
  'automation.protectedActionsRequireGate': 'boolean',
  'automation.maxRetryAttempts': 'positive-integer',
  'memory.strictScopeIsolation': 'boolean',
  'ai.routerOnly': 'boolean',
  'ai.specializedFirst': 'boolean',
  'ai.directProviderCallsAllowed': 'boolean',
  'repository.mutationMode': ['prepare-only', 'disabled']
});

function clone(value) {
  return value == null ? value : structuredClone(value);
}

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
  const parts = path.split('.');
  let node = target;
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
}

function normalizeLayer(layer = {}) {
  const flattened = flatten(layer);
  for (const [path, value] of Object.entries(flattened)) validateValue(path, value);
  const normalized = {};
  for (const [path, value] of Object.entries(flattened)) setPath(normalized, path, clone(value));
  return deepFreeze(normalized);
}

function mergeLayers(layers) {
  const result = {};
  const provenance = {};
  for (const { name, value } of layers) {
    for (const [path, item] of Object.entries(flatten(value))) {
      setPath(result, path, clone(item));
      provenance[path] = name;
    }
  }
  return { policy: deepFreeze(result), provenance: deepFreeze(provenance) };
}

export function createConfigurationPolicyLayer({ defaults = DEFAULT_POLICY, environment = {}, project = {}, rolePolicies = {} } = {}) {
  const normalizedDefaults = normalizeLayer(defaults);
  const normalizedEnvironment = normalizeLayer(environment);
  const normalizedProject = normalizeLayer(project);
  const normalizedRoles = new Map();
  for (const [role, policy] of Object.entries(rolePolicies)) normalizedRoles.set(String(role), normalizeLayer(policy));

  function resolve({ roles = [] } = {}) {
    const layers = [
      { name: 'defaults', value: normalizedDefaults },
      { name: 'environment', value: normalizedEnvironment },
      { name: 'project', value: normalizedProject }
    ];
    for (const role of roles) {
      const policy = normalizedRoles.get(String(role));
      if (policy) layers.push({ name: `role:${role}`, value: policy });
    }
    const resolved = mergeLayers(layers);
    return deepFreeze({ ...resolved, roles: Object.freeze([...roles]) });
  }

  function getSchema() {
    return POLICY_SCHEMA;
  }

  return Object.freeze({ resolve, getSchema });
}

export function createDefaultConfigurationPolicyLayer(overrides = {}) {
  return createConfigurationPolicyLayer(overrides);
}

export { DEFAULT_POLICY, POLICY_SCHEMA };
