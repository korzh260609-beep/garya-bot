const VERSION_RE = /^(\d+)\.(\d+)$/;
const PROTECTED_KEYS = new Set([
  'globalUserId','actorGlobalUserId','projectScope','groupScope','threadScope','resourceId',
  'role','grants','permissions','relation','scope','authorityEvidence','trust','confirmation',
  'credentialId','connectionId','ownerGlobalUserId'
]);

export const CRITICAL_CONTRACTS = Object.freeze([
  'canonical-input','context-bundle','memory-record','task-payload','capability-input',
  'capability-result','internal-event','resource-record','user-settings','domain-data'
]);

export class ContractVersionError extends Error {
  constructor(message, { code = 'contract-version-error', contractName = null, version = null } = {}) {
    super(message);
    this.name = 'ContractVersionError';
    this.code = code;
    this.contractName = contractName;
    this.version = version;
  }
}

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function clone(value) { return value == null ? value : structuredClone(value); }
function parseVersion(version) {
  const normalized = required(version, 'contract version');
  const match = VERSION_RE.exec(normalized);
  if (!match) throw new ContractVersionError(`invalid contract version: ${normalized}`, { code: 'contract-version-invalid', version: normalized });
  return { raw: normalized, major: Number(match[1]), minor: Number(match[2]) };
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value ?? null;
}
function same(left, right) { return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right)); }
function collectProtected(value, path = '', output = new Map()) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectProtected(entry, `${path}[${index}]`, output));
    return output;
  }
  for (const [key, nested] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (PROTECTED_KEYS.has(key)) output.set(next, clone(nested));
    collectProtected(nested, next, output);
  }
  return output;
}
function assertProtectedFieldsUnchanged(before, after) {
  const left = collectProtected(before);
  const right = collectProtected(after);
  const keys = new Set([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    if (!same(left.get(key), right.get(key))) {
      throw new ContractVersionError(`contract adapter cannot broaden or reinterpret protected field: ${key}`, { code: 'contract-adapter-protected-field-change' });
    }
  }
}
function freezeRecord(record) { return Object.freeze(clone(record)); }

export function createInMemoryContractQuarantineStore() {
  const records = new Map();
  return Object.freeze({
    async quarantine(record) {
      const normalized = freezeRecord(record);
      records.set(normalized.quarantineId, normalized);
      return normalized;
    },
    async get(quarantineId) { return clone(records.get(quarantineId) ?? null); },
    async list() { return [...records.values()].map(clone); }
  });
}

export function createContractVersioningRegistry({
  quarantineStore = createInMemoryContractQuarantineStore(),
  clock = () => new Date(),
  idFactory = () => globalThis.crypto.randomUUID(),
  observability = null
} = {}) {
  const contracts = new Map();

  function register({ contractName, currentVersion, supportedVersions = [], adapters = {}, deprecatedVersions = {} }) {
    const name = required(contractName, 'contractName');
    const current = parseVersion(currentVersion).raw;
    const supported = new Set([current, ...supportedVersions.map((value) => parseVersion(value).raw)]);
    const normalizedAdapters = new Map();
    for (const [fromVersion, adapter] of Object.entries(adapters)) {
      const from = parseVersion(fromVersion).raw;
      if (!supported.has(from)) throw new ContractVersionError(`adapter source ${from} is not supported for ${name}`, { contractName: name, version: from });
      if (typeof adapter !== 'function') throw new TypeError(`adapter for ${name}@${from} must be a function`);
      normalizedAdapters.set(from, adapter);
    }
    const deprecations = new Map();
    for (const [version, metadata] of Object.entries(deprecatedVersions)) {
      const parsed = parseVersion(version).raw;
      if (!supported.has(parsed)) throw new ContractVersionError(`deprecated version ${parsed} is not supported for ${name}`, { contractName: name, version: parsed });
      deprecations.set(parsed, freezeRecord(metadata ?? {}));
    }
    const definition = Object.freeze({ contractName: name, currentVersion: current, supportedVersions: Object.freeze([...supported]), adapters: normalizedAdapters, deprecatedVersions: deprecations });
    contracts.set(name, definition);
    return definition;
  }

  function getPolicy(contractName) {
    const name = required(contractName, 'contractName');
    const definition = contracts.get(name);
    if (!definition) throw new ContractVersionError(`unknown contract: ${name}`, { code: 'contract-unknown', contractName: name });
    return Object.freeze({
      contractName: name,
      currentVersion: definition.currentVersion,
      supportedVersions: definition.supportedVersions,
      deprecatedVersions: Object.freeze(Object.fromEntries(definition.deprecatedVersions)),
      forwardCompatibility: 'reject-unknown-newer-version',
      backwardCompatibility: 'explicit-adapter-only',
      unsupportedBehavior: 'reject-or-quarantine',
      safetyRule: 'adapters-cannot-broaden-protected-fields'
    });
  }

  async function observe(eventType, data) {
    if (!observability?.record) return;
    await observability.record({ eventClass: 'system_event', eventType, traceContext: data.traceContext ?? null, reason: null, data });
  }

  async function quarantine({ contractName, record, version, reason, traceContext = null, source = null }) {
    const quarantineId = `contract-quarantine:${required(idFactory(), 'generated quarantine id')}`;
    const quarantinedAt = clock().toISOString();
    const entry = await quarantineStore.quarantine({
      quarantineId, contractName, version, reason, source, traceContext: clone(traceContext),
      record: clone(record), quarantinedAt, status: 'quarantined'
    });
    await observe('contract_version_quarantined', { quarantineId, contractName, version, reason, traceContext });
    return entry;
  }

  async function resolve(contractName, record, { versionField = 'version', quarantineUnsupported = false, traceContext = null, source = null } = {}) {
    const name = required(contractName, 'contractName');
    const definition = contracts.get(name);
    if (!definition) throw new ContractVersionError(`unknown contract: ${name}`, { code: 'contract-unknown', contractName: name });
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError(`${name} record must be an object`);
    const sourceVersion = required(record[versionField], `${name}.${versionField}`);
    parseVersion(sourceVersion);

    if (!definition.supportedVersions.includes(sourceVersion)) {
      const error = new ContractVersionError(`unsupported ${name} version: ${sourceVersion}`, { code: 'contract-version-unsupported', contractName: name, version: sourceVersion });
      if (quarantineUnsupported) {
        const quarantined = await quarantine({ contractName: name, record, version: sourceVersion, reason: error.code, traceContext, source });
        return Object.freeze({ status: 'quarantined', contractName: name, sourceVersion, currentVersion: definition.currentVersion, record: null, quarantine: quarantined });
      }
      throw error;
    }

    if (sourceVersion === definition.currentVersion) {
      await observe('contract_version_resolved', { contractName: name, sourceVersion, currentVersion: definition.currentVersion, adapted: false, deprecated: definition.deprecatedVersions.has(sourceVersion), traceContext });
      return Object.freeze({ status: 'current', contractName: name, sourceVersion, currentVersion: definition.currentVersion, adapted: false, deprecated: definition.deprecatedVersions.has(sourceVersion), record: freezeRecord(record) });
    }

    const adapter = definition.adapters.get(sourceVersion);
    if (!adapter) {
      const error = new ContractVersionError(`no explicit adapter for ${name}@${sourceVersion}`, { code: 'contract-adapter-missing', contractName: name, version: sourceVersion });
      if (quarantineUnsupported) {
        const quarantined = await quarantine({ contractName: name, record, version: sourceVersion, reason: error.code, traceContext, source });
        return Object.freeze({ status: 'quarantined', contractName: name, sourceVersion, currentVersion: definition.currentVersion, record: null, quarantine: quarantined });
      }
      throw error;
    }

    const before = clone(record);
    const adapted = await adapter(clone(record), { fromVersion: sourceVersion, toVersion: definition.currentVersion, contractName: name });
    if (!adapted || typeof adapted !== 'object' || Array.isArray(adapted)) throw new ContractVersionError(`adapter returned invalid ${name} record`, { code: 'contract-adapter-invalid-result', contractName: name, version: sourceVersion });
    if (adapted[versionField] !== definition.currentVersion) throw new ContractVersionError(`adapter did not produce ${name}@${definition.currentVersion}`, { code: 'contract-adapter-wrong-target', contractName: name, version: sourceVersion });
    assertProtectedFieldsUnchanged(before, adapted);
    await observe('contract_version_adapted', { contractName: name, sourceVersion, currentVersion: definition.currentVersion, deprecated: definition.deprecatedVersions.has(sourceVersion), traceContext });
    return Object.freeze({ status: 'adapted', contractName: name, sourceVersion, currentVersion: definition.currentVersion, adapted: true, deprecated: definition.deprecatedVersions.has(sourceVersion), record: freezeRecord(adapted) });
  }

  return Object.freeze({ register, getPolicy, resolve, quarantine, quarantineStore });
}

function versionOnlyAdapter(record, { toVersion }) {
  return { ...record, version: toVersion };
}

export function registerDefaultContractPolicies(registry) {
  for (const contractName of CRITICAL_CONTRACTS) {
    registry.register({
      contractName,
      currentVersion: '1.0',
      supportedVersions: ['0.9'],
      adapters: { '0.9': versionOnlyAdapter },
      deprecatedVersions: { '0.9': { status: 'deprecated', replacement: '1.0', removalPolicy: 'remove-only-after-observed-zero-use-and-explicit-release-note' } }
    });
  }
  return registry;
}

export function createDefaultContractVersioning(options = {}) {
  return registerDefaultContractPolicies(createContractVersioningRegistry(options));
}
