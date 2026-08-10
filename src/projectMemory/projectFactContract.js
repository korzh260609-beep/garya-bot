import { createHash, randomUUID } from 'node:crypto';
import {
  MEMORY2_LIFECYCLE_STATES,
  MEMORY2_TRUST_LEVELS,
  createMemory2Scope
} from '../memory2/memory2.js';

export const PROJECT_MEMORY3_VERSION = 1;

export const PROJECT_MEMORY3_DOMAINS = Object.freeze([
  'architecture','features','identity','memory','security','integrations','infrastructure','decisions','roadmap','incidents'
]);

export const PROJECT_MEMORY3_FACT_TYPES = Object.freeze([
  'project-event','feature-status','architecture-decision','roadmap-state','incident','integration-status','infrastructure-state','security-state','identity-state','memory-state','relation'
]);

export const PROJECT_MEMORY3_CONFIRMATION_STATES = Object.freeze(['proposed','confirmed','rejected']);

export const PROJECT_MEMORY3_RESERVED_AUTHORITY_KEYS = Object.freeze([
  'role','roles','permission','permissions','grant','grants','owner','ownership','authority','resourceAuthority','globalUserId','authenticationLevel','accessLevel'
]);

const RESERVED_AUTHORITY_KEY_SET = new Set(PROJECT_MEMORY3_RESERVED_AUTHORITY_KEYS.map(normalizeKey));
const SECRET_KEYS = new Set(['apikey','authorization','password','passwd','secret','credential','credentials','accesstoken','refreshtoken','privatekey']);

function normalizeKey(value) { return String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optionalString(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function normalizeProjectKey(value) {
  const projectKey = requiredString(value, 'projectKey').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(projectKey)) throw new TypeError('projectKey contains unsupported characters');
  return projectKey;
}
function isoTimestamp(value, name, { required = false } = {}) {
  if (value == null) { if (required) throw new TypeError(`${name} is required`); return null; }
  const text = requiredString(String(value), name);
  if (Number.isNaN(Date.parse(text))) throw new TypeError(`${name} must be ISO timestamp`);
  return new Date(text).toISOString();
}
function boundedConfidence(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError('confidence must be between 0 and 1');
  return number;
}
function cloneJson(value, name) {
  if (value === undefined) throw new TypeError(`${name} must be JSON-compatible`);
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError(`${name} must be JSON-compatible`);
    return JSON.parse(serialized);
  } catch (error) {
    if (error instanceof TypeError && /JSON-compatible/.test(error.message)) throw error;
    throw new TypeError(`${name} must be JSON-compatible`);
  }
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function assertNoForbiddenStructuredKeys(value, path = 'fact') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, index) => assertNoForbiddenStructuredKeys(item, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (RESERVED_AUTHORITY_KEY_SET.has(normalized)) {
      const error = new Error(`Project Memory cannot carry authority field: ${path}.${key}`);
      error.code = 'project-memory-authority-field-rejected';
      throw error;
    }
    if (SECRET_KEYS.has(normalized)) {
      const error = new Error(`Project Memory cannot carry secret field: ${path}.${key}`);
      error.code = 'project-memory-secret-field-rejected';
      throw error;
    }
    assertNoForbiddenStructuredKeys(child, `${path}.${key}`);
  }
}
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function fingerprint(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
function uniqueStrings(values, name) {
  if (!Array.isArray(values)) throw new TypeError(`${name} must be an array`);
  return Object.freeze([...new Set(values.map((value) => requiredString(value, name)))].sort());
}

export function createProjectMemoryNamespace(projectKeyInput, domainInput) {
  const projectKey = normalizeProjectKey(projectKeyInput);
  const domain = requiredString(domainInput, 'domain').toLowerCase();
  if (!PROJECT_MEMORY3_DOMAINS.includes(domain)) throw new TypeError(`unsupported Project Memory domain: ${domain}`);
  return `project.${projectKey}.${domain}`;
}
export function createProjectMemoryNamespaces(projectKeyInput) {
  const projectKey = normalizeProjectKey(projectKeyInput);
  return Object.freeze(Object.fromEntries(PROJECT_MEMORY3_DOMAINS.map((domain) => [domain, createProjectMemoryNamespace(projectKey, domain)])));
}
export const SG21_PROJECT_MEMORY_NAMESPACES = createProjectMemoryNamespaces('sg2.1');
export function parseProjectMemoryNamespace(namespaceInput) {
  const namespace = requiredString(namespaceInput, 'namespace').toLowerCase();
  if (!namespace.startsWith('project.')) throw new TypeError('namespace must start with project.');
  const domain = PROJECT_MEMORY3_DOMAINS.find((candidate) => namespace.endsWith(`.${candidate}`));
  if (!domain) throw new TypeError(`unsupported Project Memory namespace: ${namespace}`);
  const projectKey = namespace.slice('project.'.length, -(domain.length + 1));
  if (!projectKey) throw new TypeError('namespace project key is required');
  normalizeProjectKey(projectKey);
  const canonical = createProjectMemoryNamespace(projectKey, domain);
  if (canonical !== namespace) throw new TypeError('namespace is not canonical');
  return Object.freeze({ namespace, projectKey, domain });
}
export function assertProjectMemoryNamespaceForProject(namespaceInput, projectKeyInput) {
  const parsed = parseProjectMemoryNamespace(namespaceInput);
  const projectKey = normalizeProjectKey(projectKeyInput);
  if (parsed.projectKey !== projectKey) {
    const error = new Error(`Project Memory namespace belongs to ${parsed.projectKey}, not ${projectKey}`);
    error.code = 'project-memory-project-scope-denied';
    throw error;
  }
  return parsed;
}
function validateFactType(value) {
  const factType = requiredString(value, 'factType').toLowerCase();
  if (!PROJECT_MEMORY3_FACT_TYPES.includes(factType)) throw new TypeError(`unsupported project fact type: ${factType}`);
  return factType;
}
function validateTrust(value) {
  const trust = requiredString(value ?? 'unverified', 'trust');
  if (!MEMORY2_TRUST_LEVELS.includes(trust)) throw new TypeError(`unsupported trust level: ${trust}`);
  return trust;
}
function validateLifecycle(value) {
  const lifecycleState = requiredString(value ?? 'active', 'lifecycleState');
  if (!MEMORY2_LIFECYCLE_STATES.includes(lifecycleState)) throw new TypeError(`unsupported lifecycle state: ${lifecycleState}`);
  return lifecycleState;
}
function validateConfirmationState(value, confirmed) {
  const state = requiredString(value ?? (confirmed ? 'confirmed' : 'proposed'), 'confirmationState');
  if (!PROJECT_MEMORY3_CONFIRMATION_STATES.includes(state)) throw new TypeError(`unsupported confirmation state: ${state}`);
  if (confirmed !== (state === 'confirmed')) throw new TypeError('confirmed flag must match confirmationState');
  return state;
}

export function createProjectFact(input = {}, { clock = () => new Date() } = {}) {
  const projectKey = normalizeProjectKey(input.projectKey);
  const parsedNamespace = assertProjectMemoryNamespaceForProject(input.namespace, projectKey);
  const factType = validateFactType(input.factType);
  const entityKey = requiredString(input.entityKey, 'entityKey');
  const fact = cloneJson(input.fact, 'fact');
  const metadata = cloneJson(input.metadata ?? {}, 'metadata');
  assertNoForbiddenStructuredKeys(fact, 'fact');
  assertNoForbiddenStructuredKeys(metadata, 'metadata');
  const sourceKind = requiredString(input.source?.kind, 'source.kind');
  const sourceRef = requiredString(input.source?.ref, 'source.ref');
  const actorId = optionalString(input.source?.actorId ?? input.actorId);
  const sourceTimestamp = isoTimestamp(input.source?.timestamp, 'source.timestamp');
  const traceId = optionalString(input.traceId);
  const sourceEventId = optionalString(input.sourceEventId);
  if (!traceId && !sourceEventId) throw new TypeError('traceId or sourceEventId is required');
  const nowValue = clock();
  const createdAt = isoTimestamp(input.createdAt ?? nowValue?.toISOString?.() ?? nowValue, 'createdAt', { required: true });
  const updatedAt = isoTimestamp(input.updatedAt ?? createdAt, 'updatedAt', { required: true });
  const validFrom = isoTimestamp(input.validFrom ?? sourceTimestamp ?? createdAt, 'validFrom', { required: true });
  const validTo = isoTimestamp(input.validTo, 'validTo');
  if (validTo && Date.parse(validTo) <= Date.parse(validFrom)) throw new TypeError('validTo must be later than validFrom');
  const trust = validateTrust(input.trust ?? 'unverified');
  const confirmed = input.confirmed === true;
  const confirmationState = validateConfirmationState(input.confirmationState, confirmed);
  const lifecycleState = validateLifecycle(input.lifecycleState ?? 'active');
  const confidence = boundedConfidence(input.confidence);
  const relationKeys = uniqueStrings(input.relationKeys ?? [], 'relationKeys');
  const tags = uniqueStrings(input.tags ?? [], 'tags');
  const recordVersion = Number(input.recordVersion ?? PROJECT_MEMORY3_VERSION);
  if (!Number.isInteger(recordVersion) || recordVersion < 1) throw new TypeError('recordVersion must be a positive integer');
  const memoryScope = createMemory2Scope({ kind: 'project', projectScope: projectKey });
  const memoryId = optionalString(input.memoryId ?? input.id) ?? randomUUID();
  const canonicalPayload = {
    projectKey,
    namespace: parsedNamespace.namespace,
    factType,
    entityKey,
    fact,
    source: { kind: sourceKind, ref: sourceRef, actorId, timestamp: sourceTimestamp },
    traceId,
    sourceEventId,
    validFrom,
    validTo,
    relationKeys,
    metadata
  };
  return deepFreeze({
    memoryId, projectKey, namespace: parsedNamespace.namespace, domain: parsedNamespace.domain, factType, entityKey, fact,
    memoryScope, layer: 'project-memory', privacyClass: 'project',
    source: { kind: sourceKind, ref: sourceRef, actorId, timestamp: sourceTimestamp },
    trust, confidence, confirmed, confirmationState, lifecycleState, traceId, sourceEventId, validFrom, validTo, createdAt, updatedAt,
    supersededAt: isoTimestamp(input.supersededAt, 'supersededAt'), successorMemoryId: optionalString(input.successorMemoryId),
    relationKeys, tags, recordVersion, semanticFingerprint: fingerprint(canonicalPayload), metadata
  });
}

export function assertProjectFactForProject(record, projectKeyInput) {
  if (!record || typeof record !== 'object') throw new TypeError('project fact record is required');
  const projectKey = normalizeProjectKey(projectKeyInput);
  if (record.projectKey !== projectKey || record.memoryScope?.projectScope !== projectKey) {
    const error = new Error(`Project fact is outside requested project scope: ${projectKey}`);
    error.code = 'project-memory-project-scope-denied';
    throw error;
  }
  assertProjectMemoryNamespaceForProject(record.namespace, projectKey);
  return record;
}
export function selectProjectFactsForProject(records, { projectKey, namespaces = null } = {}) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  const normalizedProjectKey = normalizeProjectKey(projectKey);
  const allowedNamespaces = namespaces == null ? null : new Set(namespaces.map((namespace) => assertProjectMemoryNamespaceForProject(namespace, normalizedProjectKey).namespace));
  return Object.freeze(records.filter((record) => {
    try {
      assertProjectFactForProject(record, normalizedProjectKey);
      return allowedNamespaces == null || allowedNamespaces.has(record.namespace);
    } catch { return false; }
  }));
}
