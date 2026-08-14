import { createProjectFact, createProjectMemoryNamespace } from './projectFactContract.js';

const DECISION_STATUSES = Object.freeze(['proposed', 'accepted', 'active', 'superseded', 'rejected']);
const INCIDENT_STATUSES = Object.freeze(['open', 'investigating', 'mitigated', 'resolved', 'closed']);
const TRUSTED_HISTORY = new Set(['verified', 'confirmed']);
const MAX_TEXT = 4000;
const MAX_LIST = 24;

function required(value, name, max = MAX_TEXT) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  const text = value.trim();
  if (text.length > max) throw new RangeError(`${name} exceeds ${max} characters`);
  return text;
}
function optional(value, name, max = MAX_TEXT) {
  if (value == null || String(value).trim() === '') return null;
  return required(String(value), name, max);
}
function enumValue(value, allowed, name) {
  const normalized = required(String(value), name, 64).toLowerCase();
  if (!allowed.includes(normalized)) throw new TypeError(`unsupported ${name}: ${normalized}`);
  return normalized;
}
function strings(value, name) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  if (value.length > MAX_LIST) throw new RangeError(`${name} exceeds ${MAX_LIST} items`);
  return [...new Set(value.map((item) => required(String(item), name, 500)))];
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function error(code, message) { const err = new Error(message); err.code = code; return err; }
function baseFact(input, structured) {
  return createProjectFact({
    ...input,
    projectKey: required(input.projectKey, 'projectKey', 64).toLowerCase(),
    namespace: structured.namespace,
    factType: structured.factType,
    entityKey: required(input.entityKey, 'entityKey', 500),
    fact: structured.fact,
    relationKeys: strings(input.relationKeys, 'relationKeys'),
    tags: strings(input.tags, 'tags'),
    metadata: { ...(clone(input.metadata ?? {})), pm310Kind: structured.pm310Kind }
  }, { clock: input.clock ?? (() => new Date()) });
}
function decisionView(fact) {
  return deepFreeze({
    memoryId: fact.memoryId, projectKey: fact.projectKey, entityKey: fact.entityKey,
    status: fact.fact.status, decision: fact.fact.decision, rationale: fact.fact.rationale,
    alternatives: clone(fact.fact.alternatives ?? []), consequences: clone(fact.fact.consequences ?? []),
    validFrom: fact.validFrom, validTo: fact.validTo ?? null,
    current: !fact.validTo && !fact.successorMemoryId && fact.lifecycleState === 'active',
    provenance: clone(fact.source), trust: fact.trust, confirmed: fact.confirmed,
    successorMemoryId: fact.successorMemoryId ?? null
  });
}
function incidentView(fact, retrieval = null) {
  return deepFreeze({
    memoryId: fact.memoryId, projectKey: fact.projectKey, entityKey: fact.entityKey,
    status: fact.fact.status, symptom: fact.fact.symptom,
    rootCause: fact.fact.rootCause ?? null,
    rootCauseEvidenceConfirmed: fact.fact.rootCauseEvidenceConfirmed === true,
    fix: fact.fact.fix ?? null,
    affectedComponents: clone(fact.fact.affectedComponents ?? []),
    prevention: clone(fact.fact.prevention ?? []),
    occurredAt: fact.fact.occurredAt ?? fact.validFrom, resolvedAt: fact.fact.resolvedAt ?? null,
    provenance: clone(fact.source), trust: fact.trust, confirmed: fact.confirmed,
    lifecycleState: fact.lifecycleState, retrieval: retrieval ? clone(retrieval) : null,
    advisoryOnly: true, provesLiveRootCause: false
  });
}

export const PROJECT_MEMORY3_DECISION_INCIDENT_CONTRACT_VERSION = 1;
export const PROJECT_MEMORY3_DECISION_STATUSES = DECISION_STATUSES;
export const PROJECT_MEMORY3_INCIDENT_STATUSES = INCIDENT_STATUSES;

export function createProjectDecision(input = {}) {
  const projectKey = required(input.projectKey, 'projectKey', 64).toLowerCase();
  return baseFact(input, {
    namespace: createProjectMemoryNamespace(projectKey, 'decisions'), factType: 'architecture-decision', pm310Kind: 'decision',
    fact: {
      status: enumValue(input.status ?? 'active', DECISION_STATUSES, 'decision status'),
      decision: required(input.decision, 'decision'), rationale: required(input.rationale, 'rationale'),
      alternatives: strings(input.alternatives, 'alternatives'), consequences: strings(input.consequences, 'consequences')
    }
  });
}

export function createProjectIncident(input = {}) {
  const projectKey = required(input.projectKey, 'projectKey', 64).toLowerCase();
  const status = enumValue(input.status ?? 'open', INCIDENT_STATUSES, 'incident status');
  const rootCause = optional(input.rootCause, 'rootCause');
  const rootCauseEvidenceConfirmed = input.rootCauseEvidenceConfirmed === true;
  if (rootCause && !rootCauseEvidenceConfirmed) throw error('project-memory-incident-root-cause-unconfirmed', 'incident rootCause requires evidence confirmation');
  if (!rootCause && rootCauseEvidenceConfirmed) throw error('project-memory-incident-root-cause-missing', 'rootCauseEvidenceConfirmed requires rootCause');
  const fix = optional(input.fix, 'fix');
  if (['resolved', 'closed'].includes(status) && !fix) throw error('project-memory-incident-fix-required', 'resolved/closed incident requires a fix');
  const occurredAt = optional(input.occurredAt, 'occurredAt', 128);
  const resolvedAt = optional(input.resolvedAt, 'resolvedAt', 128);
  if (occurredAt && Number.isNaN(Date.parse(occurredAt))) throw new TypeError('occurredAt must be an ISO timestamp');
  if (resolvedAt && Number.isNaN(Date.parse(resolvedAt))) throw new TypeError('resolvedAt must be an ISO timestamp');
  if (resolvedAt && occurredAt && Date.parse(resolvedAt) < Date.parse(occurredAt)) throw new TypeError('resolvedAt must not precede occurredAt');
  return baseFact(input, {
    namespace: createProjectMemoryNamespace(projectKey, 'incidents'), factType: 'incident', pm310Kind: 'incident',
    fact: {
      status, symptom: required(input.symptom, 'symptom'), rootCause, rootCauseEvidenceConfirmed, fix,
      affectedComponents: strings(input.affectedComponents, 'affectedComponents'), prevention: strings(input.prevention, 'prevention'),
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      resolvedAt: resolvedAt ? new Date(resolvedAt).toISOString() : null
    }
  });
}

export function createProjectDecisionIncidentMemory({ retrieval, temporalHistory, authorize } = {}) {
  if (!retrieval?.search) throw new TypeError('retrieval.search is required');
  if (!temporalHistory?.getCurrent || !temporalHistory?.getAt || !temporalHistory?.getChain) throw new TypeError('temporalHistory is required');
  if (typeof authorize !== 'function') throw new TypeError('authorize callback is required');

  async function assertAuthorized({ actor, projectKey, operation }) {
    if (await authorize({ actor, projectKey, operation }) !== true) throw error('project-memory-decision-incident-unauthorized', `${operation} denied for ${projectKey}`);
  }

  async function getCurrentDecision({ actor, projectKey, entityKey } = {}) {
    const project = required(projectKey, 'projectKey', 64).toLowerCase();
    const entity = required(entityKey, 'entityKey', 500);
    await assertAuthorized({ actor, projectKey: project, operation: 'decision-read' });
    const records = await temporalHistory.getCurrent({ projectKey: project, namespace: createProjectMemoryNamespace(project, 'decisions'), factType: 'architecture-decision', entityKey: entity, limit: 10 });
    const current = records.find((record) => record.lifecycleState === 'active' && record.confirmed === true && record.confirmationState === 'confirmed') ?? null;
    return current ? decisionView(current) : null;
  }

  async function getDecisionAt({ actor, projectKey, entityKey, at } = {}) {
    const project = required(projectKey, 'projectKey', 64).toLowerCase();
    const entity = required(entityKey, 'entityKey', 500);
    await assertAuthorized({ actor, projectKey: project, operation: 'decision-history-read' });
    const records = await temporalHistory.getAt({ projectKey: project, namespace: createProjectMemoryNamespace(project, 'decisions'), factType: 'architecture-decision', entityKey: entity, at, limit: 10 });
    const selected = records.find((record) => record.confirmed === true && record.confirmationState === 'confirmed') ?? null;
    return selected ? decisionView(selected) : null;
  }

  async function explainDecision({ actor, projectKey, entityKey } = {}) {
    const decision = await getCurrentDecision({ actor, projectKey, entityKey });
    if (!decision) return null;
    return deepFreeze({ kind: 'ProjectDecisionExplanation', contractVersion: PROJECT_MEMORY3_DECISION_INCIDENT_CONTRACT_VERSION, ...decision, answer: `${decision.decision}\nRationale: ${decision.rationale}`, evidenceAware: true });
  }

  async function getDecisionHistory({ actor, projectKey, memoryId } = {}) {
    const project = required(projectKey, 'projectKey', 64).toLowerCase();
    await assertAuthorized({ actor, projectKey: project, operation: 'decision-history-read' });
    const chain = await temporalHistory.getChain({ projectKey: project, memoryId: required(memoryId, 'memoryId', 500) });
    return deepFreeze(chain.filter((record) => record.factType === 'architecture-decision' && record.confirmed === true).map(decisionView));
  }

  async function findIncidentGuidance({ actor, projectKey, query, limit = 5, queryEmbedding = null, modelKey = null } = {}) {
    const project = required(projectKey, 'projectKey', 64).toLowerCase();
    const text = required(query, 'query');
    await assertAuthorized({ actor, projectKey: project, operation: 'incident-guidance-read' });
    const retrievalResult = await retrieval.search({
      actor, projectKey: project, query: text, queryEmbedding, modelKey,
      namespaces: [createProjectMemoryNamespace(project, 'incidents')], factTypes: ['incident'],
      lifecycleStates: ['active', 'archived'], includeHistorical: true, expandRelations: true,
      limit: Math.max(1, Math.min(Number(limit) || 5, 12))
    });
    const guidance = retrievalResult.results
      .filter((item) => item.record?.confirmed === true && item.record?.confirmationState === 'confirmed' && TRUSTED_HISTORY.has(item.record?.trust))
      .map((item) => incidentView(item.record, {
        score: Number(item.score ?? 0), semanticScore: Number(item.semanticScore ?? 0), lexicalScore: Number(item.lexicalScore ?? 0), exactScore: Number(item.exactScore ?? 0), relationExpanded: item.relationExpanded === true
      }));
    return deepFreeze({
      kind: 'HistoricalIncidentGuidance', contractVersion: PROJECT_MEMORY3_DECISION_INCIDENT_CONTRACT_VERSION,
      projectKey: project, query: text, advisoryOnly: true, provesLiveRootCause: false,
      requiresLiveVerification: true, modelContextEligible: false, incidents: guidance
    });
  }

  return Object.freeze({ getCurrentDecision, getDecisionAt, explainDecision, getDecisionHistory, findIncidentGuidance });
}
