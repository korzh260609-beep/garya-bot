import { assertProjectMemoryNamespaceForProject } from './projectFactContract.js';

const DEFAULT_MAX_FACTS = 8;
const MAX_FACTS = 24;
const DEFAULT_MAX_TOKENS = 1200;
const MAX_TOKENS = 4000;
const DEFAULT_TRUST = Object.freeze(['verified', 'confirmed']);
const DEFAULT_LIFECYCLE = Object.freeze(['active']);
const BLOCKED_SENSITIVITY = new Set(['sensitive', 'confidential', 'secret', 'restricted', 'credential']);
const SENSITIVE_KEYS = new Set([
  'apikey','authorization','password','passwd','secret','credential','credentials','accesstoken','refreshtoken','privatekey','token','bottoken'
]);
const SECRET_VALUE_PATTERNS = Object.freeze([
  /\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{12,}\b/i,
  /\b(?:sk|rk|pk)-[a-z0-9_-]{16,}\b/i,
  /\bgh[oprsu]_[a-z0-9]{20,}\b/i,
  /\b\d{6,12}:[a-z0-9_-]{25,}\b/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i
]);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function normalizeKey(value) { return String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function uniqueStrings(values, name) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new TypeError(`${name} must be an array`);
  return [...new Set(values.map((value) => required(String(value), name)))].sort();
}
function boundedInteger(value, fallback, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(Math.trunc(number), max));
}
function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function contextError(code, message) { const error = new Error(message); error.code = code; return error; }
function approximateTokens(value) { return Math.max(1, Math.ceil(JSON.stringify(value).length / 4)); }
function hasSensitiveValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
  if (Array.isArray(value)) return value.some(hasSensitiveValue);
  if (typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(normalizeKey(key))) return true;
    if (hasSensitiveValue(child)) return true;
  }
  return false;
}
function sensitivity(record) {
  return normalizeKey(record?.metadata?.sensitivity ?? record?.metadata?.classification ?? '');
}
function temporalState(record, nowMs) {
  const from = Date.parse(record.validFrom ?? 0);
  const to = record.validTo == null ? Infinity : Date.parse(record.validTo);
  if (!Number.isFinite(from) || from > nowMs) return 'not-yet-valid';
  if (!(nowMs < to)) return 'expired';
  if (record.supersededAt || record.successorMemoryId) return 'superseded';
  return 'current';
}
function provenance(record) {
  return {
    sourceKind: record.source?.kind ?? null,
    sourceRef: record.source?.ref ?? null,
    sourceTimestamp: record.source?.timestamp ?? null,
    actorId: record.source?.actorId ?? null,
    traceId: record.traceId ?? null,
    sourceEventId: record.sourceEventId ?? null
  };
}
function sufficientProvenance(record) {
  return typeof record.source?.kind === 'string' && record.source.kind.trim() !== ''
    && typeof record.source?.ref === 'string' && record.source.ref.trim() !== ''
    && Boolean(record.traceId || record.sourceEventId);
}
function exclusionReason(record, policy, nowMs) {
  try { assertProjectMemoryNamespaceForProject(record.namespace, policy.projectKey); } catch { return 'namespace-scope'; }
  if (record.projectKey !== policy.projectKey || record.memoryScope?.projectScope !== policy.projectKey) return 'project-scope';
  if (policy.allowedNamespaces.length && !policy.allowedNamespaces.includes(record.namespace)) return 'namespace-policy';
  if (record.confirmationState === 'rejected') return 'rejected';
  if (!policy.includeProposed && (!record.confirmed || record.confirmationState !== 'confirmed')) return 'unconfirmed';
  if (!policy.allowedTrust.includes(record.trust)) return 'trust';
  if (!policy.allowedLifecycleStates.includes(record.lifecycleState)) return 'lifecycle';
  const temporal = temporalState(record, nowMs);
  if (!policy.includeHistorical && temporal !== 'current') return temporal;
  if (policy.includeHistorical && temporal === 'not-yet-valid') return temporal;
  if (BLOCKED_SENSITIVITY.has(sensitivity(record))) return 'sensitive';
  if (hasSensitiveValue(record.fact) || hasSensitiveValue(record.metadata) || hasSensitiveValue(record.tags)) return 'secret-bearing';
  if (!sufficientProvenance(record)) return 'insufficient-provenance';
  return null;
}

export const PROJECT_MEMORY3_CONTEXT_GUARD_CONTRACT_VERSION = 1;

export function createProjectMemoryContextGuard({ database, authorize, retrieval = null, clock = () => new Date() } = {}) {
  if (!database?.query) throw new TypeError('started PostgreSQL database is required');
  if (typeof authorize !== 'function') throw new TypeError('authorize callback is required');
  if (retrieval != null && typeof retrieval.search !== 'function') throw new TypeError('retrieval.search is required');

  async function assertAuthorized({ actor, projectKey }) {
    const allowed = await authorize({ actor, projectKey, operation: 'context-read' });
    if (allowed !== true) throw contextError('project-memory-context-unauthorized', `Project Memory context denied for ${projectKey}`);
  }

  async function openConflicts(projectKey, memoryIds) {
    if (memoryIds.length === 0) return new Map();
    const result = await database.query(`SELECT conflict_id,memory_id,conflicting_memory_id,reason,detected_at
      FROM project_memory_conflicts
      WHERE project_key=$1 AND status='open' AND (memory_id=ANY($2::text[]) OR conflicting_memory_id=ANY($2::text[]))
      ORDER BY detected_at,conflict_id`, [projectKey, memoryIds]);
    const byMemory = new Map();
    for (const row of result.rows) {
      for (const id of [row.memory_id, row.conflicting_memory_id]) {
        if (!memoryIds.includes(id)) continue;
        const list = byMemory.get(id) ?? [];
        list.push(Object.freeze({
          conflictId: row.conflict_id,
          otherMemoryId: id === row.memory_id ? row.conflicting_memory_id : row.memory_id,
          reason: row.reason,
          detectedAt: row.detected_at instanceof Date ? row.detected_at.toISOString() : new Date(row.detected_at).toISOString()
        }));
        byMemory.set(id, list);
      }
    }
    return byMemory;
  }

  async function build(input = {}) {
    const projectKey = required(input.projectKey, 'projectKey').toLowerCase();
    await assertAuthorized({ actor: input.actor, projectKey });
    const retrievalResult = input.retrievalResult;
    if (!retrievalResult || !Array.isArray(retrievalResult.results)) throw new TypeError('retrievalResult.results is required');
    if (retrievalResult.projectKey !== projectKey) throw contextError('project-memory-context-project-mismatch', 'retrieval result project does not match requested project');

    const allowedNamespaces = uniqueStrings(input.allowedNamespaces, 'allowedNamespaces');
    for (const namespace of allowedNamespaces) assertProjectMemoryNamespaceForProject(namespace, projectKey);
    const policy = {
      projectKey,
      allowedNamespaces,
      allowedTrust: uniqueStrings(input.allowedTrust ?? DEFAULT_TRUST, 'allowedTrust'),
      allowedLifecycleStates: uniqueStrings(input.allowedLifecycleStates ?? DEFAULT_LIFECYCLE, 'allowedLifecycleStates'),
      includeProposed: input.includeProposed === true,
      includeHistorical: input.includeHistorical === true
    };
    const maxFacts = boundedInteger(input.maxFacts, DEFAULT_MAX_FACTS, MAX_FACTS);
    const maxTokens = boundedInteger(input.maxTokens, DEFAULT_MAX_TOKENS, MAX_TOKENS);
    const nowValue = clock();
    const now = new Date(nowValue?.toISOString?.() ?? nowValue);
    if (Number.isNaN(now.getTime())) throw new TypeError('clock must return a valid time');

    const exclusions = Object.create(null);
    const eligible = [];
    for (const item of retrievalResult.results) {
      const record = item?.record;
      const reason = !record ? 'malformed-result' : exclusionReason(record, policy, now.getTime());
      if (reason) { exclusions[reason] = (exclusions[reason] ?? 0) + 1; continue; }
      eligible.push({ item, record });
    }

    const conflictMap = await openConflicts(projectKey, eligible.map(({ record }) => record.memoryId));
    const facts = [];
    let estimatedTokens = 0;
    let budgetExcluded = 0;
    for (const { item, record } of eligible) {
      if (facts.length >= maxFacts) { budgetExcluded += 1; continue; }
      const conflicts = conflictMap.get(record.memoryId) ?? [];
      const projected = {
        memoryId: record.memoryId,
        namespace: record.namespace,
        factType: record.factType,
        entityKey: record.entityKey,
        factData: cloneJson(record.fact),
        tags: cloneJson(record.tags ?? []),
        trust: record.trust,
        confidence: record.confidence ?? null,
        confirmed: record.confirmed === true,
        confirmationState: record.confirmationState,
        lifecycleState: record.lifecycleState,
        validFrom: record.validFrom,
        validTo: record.validTo ?? null,
        currentness: temporalState(record, now.getTime()),
        provenance: provenance(record),
        conflict: { open: conflicts.length > 0, count: conflicts.length, records: conflicts },
        retrieval: {
          score: Number(item.score ?? 0),
          semanticScore: Number(item.semanticScore ?? 0),
          lexicalScore: Number(item.lexicalScore ?? 0),
          exactScore: Number(item.exactScore ?? 0),
          relationExpanded: item.relationExpanded === true
        },
        dataOnly: true
      };
      const tokens = approximateTokens(projected);
      if (estimatedTokens + tokens > maxTokens) { budgetExcluded += 1; continue; }
      estimatedTokens += tokens;
      facts.push(deepFreeze(projected));
    }
    if (budgetExcluded) exclusions.budget = (exclusions.budget ?? 0) + budgetExcluded;

    return deepFreeze({
      contractVersion: PROJECT_MEMORY3_CONTEXT_GUARD_CONTRACT_VERSION,
      kind: 'ProjectMemoryContext',
      projectKey,
      generatedAt: now.toISOString(),
      dataPolicy: {
        contentIsDataOnly: true,
        executableInstructionsAllowed: false,
        authorityFromMemoryAllowed: false,
        secretsAllowed: false
      },
      limits: { maxFacts, maxTokens, factCount: facts.length, estimatedTokens },
      conflictSummary: {
        factsWithOpenConflicts: facts.filter((fact) => fact.conflict.open).length,
        openConflictReferences: facts.reduce((sum, fact) => sum + fact.conflict.count, 0)
      },
      exclusions: Object.freeze(Object.fromEntries(Object.entries(exclusions).sort(([a], [b]) => a.localeCompare(b)))),
      facts: Object.freeze(facts)
    });
  }

  async function retrieve(input = {}) {
    if (!retrieval) throw new TypeError('retrieval service was not configured');
    const retrievalResult = await retrieval.search(input);
    return build({ ...input, retrievalResult });
  }

  return Object.freeze({ build, retrieve });
}
