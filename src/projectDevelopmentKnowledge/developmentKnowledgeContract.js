import { createHash, randomUUID } from 'node:crypto';
import {
  PROJECT_MEMORY3_DOMAINS,
  createProjectFact,
  createProjectMemoryNamespace
} from '../projectMemory/index.js';

export const PDK4_CONTRACT_VERSION = 1;

export const PDK4_EVENT_TYPES = Object.freeze([
  'origin','requirement','problem','proposal','decision','rationale','alternative','plan','milestone','implementation','refactor','rework','migration','bug','incident','root-cause','fix','test','ci-verification','deployment','runtime-verification','result','rejected','abandoned','superseded','current-state','next-plan'
]);

export const PDK4_DEVELOPMENT_STATES = Object.freeze([
  'conceived','proposed','approved','planned','implementing','implemented','testing','ci-verified','deployed','live-verified','closed','deprecated','superseded','rejected','unknown'
]);

export const PDK4_RELATION_TYPES = Object.freeze([
  'originates-from','motivated-by','proposes','rejects','approved-as','implements','refines','refactors','migrates-from','fixes','caused-by','verified-by-test','verified-by-ci','deployed-as','verified-in-runtime','supersedes','superseded-by','depends-on','blocks','unblocks','belongs-to-milestone','next-after'
]);

export const PDK4_SOURCE_KINDS = Object.freeze(['github-commit','github-pr','github-workflow','canonical-document','deployment-evidence','runtime-evidence','conversation-candidate']);
export const PDK4_VERIFICATION_KINDS = Object.freeze(['source','code','test','ci','deployment','runtime','monarch-confirmation']);

export const PDK4_DERIVED_VIEW_TYPES = Object.freeze(['project-genesis','product-timeline','component-history','project-snapshot']);

export const PDK4_PROJECT_GENESIS_FIELDS = Object.freeze([
  'projectName','originalIdea','originalGoal','earliestVerifiedEvidence','firstRelevantCommit','initialArchitecture','firstWorkingMilestone','foundationalDecisions','earlyLimitations','majorEvolutionMilestones'
]);

export const PDK4_PROJECT_SNAPSHOT_FIELDS = Object.freeze([
  'projectKey','sourceRevision','sourceCursor','generatedAt','implemented','ciVerified','deployed','liveVerified','activeDecisions','knownIssues','openIncidents','currentWork','nextMilestones','risks','staleEvidence','unresolvedGaps'
]);

const RESERVED_AUTHORITY_KEYS = new Set([
  'role','roles','permission','permissions','grant','grants','owner','ownership','authority','resourceauthority','globaluserid','authenticationlevel','accesslevel'
]);
const SECRET_KEYS = new Set(['apikey','authorization','password','passwd','secret','credential','credentials','accesstoken','refreshtoken','privatekey','token']);
const PRIVATE_USER_KEYS = new Set(['email','phone','phonenumber','address','birthdate','passport','personaldata']);
const REQUIRED_EVIDENCE_BY_STATE = Object.freeze({
  implemented: ['code'],
  'ci-verified': ['ci'],
  deployed: ['deployment'],
  'live-verified': ['runtime']
});

const ALLOWED_STATE_TRANSITIONS = Object.freeze({
  unknown: new Set(['unknown','conceived','proposed']),
  conceived: new Set(['conceived','proposed','rejected','abandoned']),
  proposed: new Set(['proposed','approved','planned','rejected','abandoned']),
  approved: new Set(['approved','planned','implementing','rejected','superseded']),
  planned: new Set(['planned','implementing','rejected','abandoned','superseded']),
  implementing: new Set(['implementing','implemented','testing','rejected','abandoned']),
  implemented: new Set(['implemented','testing','ci-verified','deployed','deprecated','superseded']),
  testing: new Set(['testing','implementing','implemented','ci-verified','rejected']),
  'ci-verified': new Set(['ci-verified','deployed','deprecated','superseded']),
  deployed: new Set(['deployed','live-verified','deprecated','superseded']),
  'live-verified': new Set(['live-verified','closed','deprecated','superseded']),
  closed: new Set(['closed','deprecated','superseded']),
  deprecated: new Set(['deprecated','superseded']),
  superseded: new Set(['superseded']),
  rejected: new Set(['rejected']),
  abandoned: new Set(['abandoned'])
});

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
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function fingerprint(value) { return createHash('sha256').update(stable(value)).digest('hex'); }
function boundedConfidence(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError('confidence must be between 0 and 1');
  return number;
}
function uniqueStrings(values, name) {
  if (!Array.isArray(values)) throw new TypeError(`${name} must be an array`);
  return Object.freeze([...new Set(values.map((value) => requiredString(value, name)))].sort());
}
function assertNoForbiddenStructuredKeys(value, path = 'payload') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, index) => assertNoForbiddenStructuredKeys(item, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (RESERVED_AUTHORITY_KEYS.has(normalized)) {
      const error = new Error(`PDK4 cannot carry authority field: ${path}.${key}`);
      error.code = 'pdk4-authority-field-rejected';
      throw error;
    }
    if (SECRET_KEYS.has(normalized)) {
      const error = new Error(`PDK4 cannot carry secret field: ${path}.${key}`);
      error.code = 'pdk4-secret-field-rejected';
      throw error;
    }
    if (PRIVATE_USER_KEYS.has(normalized)) {
      const error = new Error(`PDK4 cannot carry private user field: ${path}.${key}`);
      error.code = 'pdk4-private-user-field-rejected';
      throw error;
    }
    assertNoForbiddenStructuredKeys(child, `${path}.${key}`);
  }
}
function enumValue(value, name, allowed) {
  const normalized = requiredString(value, name).toLowerCase();
  if (!allowed.includes(normalized)) throw new TypeError(`unsupported ${name}: ${normalized}`);
  return normalized;
}
function normalizeDomain(value) { return enumValue(value, 'domain', PROJECT_MEMORY3_DOMAINS); }
function normalizeEventType(value) { return enumValue(value, 'eventType', PDK4_EVENT_TYPES); }
function normalizeDevelopmentState(value, name = 'developmentState') { return enumValue(value ?? 'unknown', name, PDK4_DEVELOPMENT_STATES); }
function normalizeRelationType(value) { return enumValue(value, 'relation.type', PDK4_RELATION_TYPES); }
function normalizeVerificationKind(value) { return enumValue(value, 'verification.kind', PDK4_VERIFICATION_KINDS); }

export function assertDevelopmentStateTransition(previousStateInput, newStateInput, verification = []) {
  const previousState = normalizeDevelopmentState(previousStateInput, 'previousState');
  const newState = normalizeDevelopmentState(newStateInput, 'newState');
  if (!ALLOWED_STATE_TRANSITIONS[previousState]?.has(newState)) {
    const error = new Error(`invalid PDK4 development state transition: ${previousState} -> ${newState}`);
    error.code = 'pdk4-invalid-state-transition';
    throw error;
  }
  const evidenceKinds = new Set((verification ?? []).map((entry) => normalizeVerificationKind(entry?.kind)));
  for (const requiredKind of REQUIRED_EVIDENCE_BY_STATE[newState] ?? []) {
    if (!evidenceKinds.has(requiredKind)) {
      const error = new Error(`PDK4 state ${newState} requires ${requiredKind} evidence`);
      error.code = 'pdk4-state-evidence-required';
      throw error;
    }
  }
  return Object.freeze({ previousState, newState });
}

export function createDevelopmentSourceIdentity(input = {}) {
  const kind = enumValue(input.kind, 'source.kind', PDK4_SOURCE_KINDS);
  const projectKey = normalizeProjectKey(input.projectKey);
  const repository = optionalString(input.repository)?.toLowerCase() ?? null;
  let identity;
  if (kind === 'github-commit') {
    const sha = requiredString(input.sha, 'source.sha').toLowerCase();
    if (!/^[a-f0-9]{7,64}$/.test(sha)) throw new TypeError('source.sha must be a hexadecimal git revision');
    identity = { kind, projectKey, repository: requiredString(repository, 'source.repository'), sha };
  } else if (kind === 'github-pr') {
    const number = Number(input.number);
    if (!Number.isInteger(number) || number < 1) throw new TypeError('source.number must be a positive integer');
    identity = { kind, projectKey, repository: requiredString(repository, 'source.repository'), number, headSha: requiredString(input.headSha, 'source.headSha').toLowerCase() };
  } else if (kind === 'github-workflow') {
    const runId = String(input.runId ?? '').trim();
    const attempt = Number(input.attempt ?? 1);
    if (!/^\d+$/.test(runId)) throw new TypeError('source.runId must be numeric');
    if (!Number.isInteger(attempt) || attempt < 1) throw new TypeError('source.attempt must be a positive integer');
    identity = { kind, projectKey, repository: requiredString(repository, 'source.repository'), runId, attempt };
  } else if (kind === 'canonical-document') {
    identity = { kind, projectKey, repository: requiredString(repository, 'source.repository'), path: requiredString(input.path, 'source.path'), revision: requiredString(input.revision, 'source.revision').toLowerCase() };
  } else {
    identity = { kind, projectKey, ref: requiredString(input.ref, 'source.ref'), revision: optionalString(input.revision) };
  }
  return deepFreeze({ ...identity, sourceId: `pdk4:${fingerprint(identity)}`, fingerprint: fingerprint(identity) });
}

function normalizeProvenance(entries, projectKey) {
  if (!Array.isArray(entries) || entries.length === 0) throw new TypeError('provenance must contain at least one source identity');
  const seen = new Set();
  const normalized = [];
  for (const entry of entries) {
    const source = entry?.sourceId && entry?.fingerprint ? cloneJson(entry, 'provenance') : createDevelopmentSourceIdentity({ ...entry, projectKey: entry?.projectKey ?? projectKey });
    if (source.projectKey !== projectKey) {
      const error = new Error(`PDK4 provenance belongs to ${source.projectKey}, not ${projectKey}`);
      error.code = 'pdk4-project-scope-denied';
      throw error;
    }
    if (!seen.has(source.sourceId)) { seen.add(source.sourceId); normalized.push(source); }
  }
  return Object.freeze(normalized);
}
function normalizeVerification(entries, projectKey) {
  if (!Array.isArray(entries ?? [])) throw new TypeError('verification must be an array');
  return Object.freeze((entries ?? []).map((entry) => {
    const kind = normalizeVerificationKind(entry?.kind);
    const sourceId = optionalString(entry?.sourceId);
    const project = normalizeProjectKey(entry?.projectKey ?? projectKey);
    if (project !== projectKey) {
      const error = new Error(`PDK4 verification belongs to ${project}, not ${projectKey}`);
      error.code = 'pdk4-project-scope-denied';
      throw error;
    }
    return deepFreeze({ kind, projectKey: project, sourceId, ref: optionalString(entry?.ref), verifiedAt: isoTimestamp(entry?.verifiedAt, 'verification.verifiedAt') });
  }));
}
function normalizeRelations(entries, projectKey) {
  if (!Array.isArray(entries ?? [])) throw new TypeError('relatedEvents must be an array');
  return Object.freeze((entries ?? []).map((entry) => {
    const relationProjectKey = normalizeProjectKey(entry?.projectKey ?? projectKey);
    if (relationProjectKey !== projectKey) {
      const error = new Error(`PDK4 relation belongs to ${relationProjectKey}, not ${projectKey}`);
      error.code = 'pdk4-project-scope-denied';
      throw error;
    }
    return deepFreeze({ type: normalizeRelationType(entry?.type), eventId: requiredString(entry?.eventId, 'relation.eventId'), projectKey: relationProjectKey });
  }));
}

export function createDevelopmentEvent(input = {}, { clock = () => new Date() } = {}) {
  const projectKey = normalizeProjectKey(input.projectKey);
  const eventType = normalizeEventType(input.eventType);
  const domain = normalizeDomain(input.domain);
  const component = requiredString(input.component, 'component');
  const title = requiredString(input.title, 'title');
  const summary = requiredString(input.summary, 'summary');
  const provenance = normalizeProvenance(input.provenance, projectKey);
  const verification = normalizeVerification(input.verification, projectKey);
  const previousState = normalizeDevelopmentState(input.previousState ?? 'unknown', 'previousState');
  const newState = normalizeDevelopmentState(input.newState ?? previousState, 'newState');
  assertDevelopmentStateTransition(previousState, newState, verification);
  const occurredAt = isoTimestamp(input.occurredAt, 'occurredAt', { required: true });
  const effectiveAt = isoTimestamp(input.effectiveAt ?? occurredAt, 'effectiveAt', { required: true });
  const nowValue = clock();
  const createdAt = isoTimestamp(input.createdAt ?? nowValue?.toISOString?.() ?? nowValue, 'createdAt', { required: true });
  const payload = cloneJson({
    intent: input.intent ?? null,
    problem: input.problem ?? null,
    rationale: input.rationale ?? null,
    alternatives: input.alternatives ?? [],
    implementation: input.implementation ?? null,
    result: input.result ?? null,
    limitations: input.limitations ?? []
  }, 'development payload');
  assertNoForbiddenStructuredKeys(payload, 'development');
  const relatedEvents = normalizeRelations(input.relatedEvents, projectKey);
  const supersedes = uniqueStrings(input.supersedes ?? [], 'supersedes');
  const supersededBy = uniqueStrings(input.supersededBy ?? [], 'supersededBy');
  const derivedFrom = uniqueStrings(input.derivedFrom ?? provenance.map((source) => source.sourceId), 'derivedFrom');
  const lifecycleState = enumValue(input.lifecycleState ?? 'active', 'lifecycleState', ['active','superseded','archived']);
  if (newState === 'superseded' && lifecycleState !== 'superseded') {
    const error = new Error('superseded development state requires superseded lifecycleState');
    error.code = 'pdk4-invalid-lifecycle-state';
    throw error;
  }
  if (lifecycleState === 'superseded' && supersededBy.length === 0) {
    const error = new Error('superseded lifecycleState requires supersededBy');
    error.code = 'pdk4-supersession-target-required';
    throw error;
  }
  const confidence = boundedConfidence(input.confidence);
  const traceId = requiredString(input.traceId, 'traceId');
  const canonical = { projectKey,eventType,domain,component,title,summary,payload,previousState,newState,occurredAt,effectiveAt,provenance: provenance.map((source) => source.sourceId),relatedEvents,supersedes,supersededBy,derivedFrom,verification };
  const eventId = optionalString(input.eventId) ?? `dev_evt_${fingerprint(canonical).slice(0, 32)}`;
  return deepFreeze({
    contractVersion: PDK4_CONTRACT_VERSION,
    eventId, projectKey, eventType, domain, component, title, summary,
    ...payload,
    previousState, newState, lifecycleState, occurredAt, effectiveAt, provenance,
    relatedEvents, supersedes, supersededBy, derivedFrom, verification, confidence, traceId, createdAt,
    semanticFingerprint: fingerprint(canonical)
  });
}

export function createProjectGenesisView(input = {}) {
  const projectKey = normalizeProjectKey(input.projectKey);
  const view = cloneJson({
    viewType: 'project-genesis', projectKey,
    projectName: input.projectName ?? null,
    originalIdea: input.originalIdea ?? null,
    originalGoal: input.originalGoal ?? null,
    earliestVerifiedEvidence: input.earliestVerifiedEvidence ?? null,
    firstRelevantCommit: input.firstRelevantCommit ?? null,
    initialArchitecture: input.initialArchitecture ?? null,
    firstWorkingMilestone: input.firstWorkingMilestone ?? null,
    foundationalDecisions: input.foundationalDecisions ?? [],
    earlyLimitations: input.earlyLimitations ?? [],
    majorEvolutionMilestones: input.majorEvolutionMilestones ?? [],
    derivedFrom: input.derivedFrom ?? []
  }, 'ProjectGenesis');
  assertNoForbiddenStructuredKeys(view, 'ProjectGenesis');
  return deepFreeze(view);
}

export function createProductTimelineView(input = {}) {
  const projectKey = normalizeProjectKey(input.projectKey);
  const events = cloneJson(input.events ?? [], 'ProductTimeline.events');
  if (!Array.isArray(events)) throw new TypeError('ProductTimeline.events must be an array');
  assertNoForbiddenStructuredKeys(events, 'ProductTimeline.events');
  return deepFreeze({ viewType: 'product-timeline', projectKey, events });
}

export function createComponentHistoryView(input = {}) {
  const projectKey = normalizeProjectKey(input.projectKey);
  const component = requiredString(input.component, 'component');
  const events = cloneJson(input.events ?? [], 'ComponentHistory.events');
  if (!Array.isArray(events)) throw new TypeError('ComponentHistory.events must be an array');
  assertNoForbiddenStructuredKeys(events, 'ComponentHistory.events');
  return deepFreeze({ viewType: 'component-history', projectKey, component, events });
}

export function createProjectSnapshotView(input = {}, { clock = () => new Date() } = {}) {
  const projectKey = normalizeProjectKey(input.projectKey);
  const generatedAt = isoTimestamp(input.generatedAt ?? clock().toISOString(), 'generatedAt', { required: true });
  const view = cloneJson({
    viewType: 'project-snapshot', projectKey,
    sourceRevision: input.sourceRevision ?? null,
    sourceCursor: input.sourceCursor ?? null,
    generatedAt,
    implemented: input.implemented ?? [],
    ciVerified: input.ciVerified ?? [],
    deployed: input.deployed ?? [],
    liveVerified: input.liveVerified ?? [],
    activeDecisions: input.activeDecisions ?? [],
    knownIssues: input.knownIssues ?? [],
    openIncidents: input.openIncidents ?? [],
    currentWork: input.currentWork ?? [],
    nextMilestones: input.nextMilestones ?? [],
    risks: input.risks ?? [],
    staleEvidence: input.staleEvidence ?? [],
    unresolvedGaps: input.unresolvedGaps ?? []
  }, 'ProjectSnapshot');
  assertNoForbiddenStructuredKeys(view, 'ProjectSnapshot');
  return deepFreeze(view);
}

export function createDevelopmentEventProjectFactCandidate(event, { trust = 'unverified', confirmed = false, confirmationState = confirmed ? 'confirmed' : 'proposed' } = {}) {
  if (!event || typeof event !== 'object') throw new TypeError('development event is required');
  const namespace = createProjectMemoryNamespace(event.projectKey, event.domain);
  const primarySource = event.provenance?.[0];
  if (!primarySource) throw new TypeError('development event provenance is required');
  return createProjectFact({
    projectKey: event.projectKey,
    namespace,
    factType: 'project-event',
    entityKey: event.eventId,
    fact: {
      pdk4ContractVersion: event.contractVersion,
      eventType: event.eventType,
      component: event.component,
      title: event.title,
      summary: event.summary,
      intent: event.intent,
      problem: event.problem,
      rationale: event.rationale,
      alternatives: event.alternatives,
      previousState: event.previousState,
      newState: event.newState,
      implementation: event.implementation,
      result: event.result,
      limitations: event.limitations,
      occurredAt: event.occurredAt,
      effectiveAt: event.effectiveAt,
      provenance: event.provenance.map(({ sourceId, fingerprint, kind, projectKey }) => ({ sourceId, fingerprint, kind, projectKey })),
      relatedEvents: event.relatedEvents,
      supersedes: event.supersedes,
      supersededBy: event.supersededBy,
      derivedFrom: event.derivedFrom,
      verification: event.verification
    },
    source: { kind: primarySource.kind, ref: primarySource.sourceId, timestamp: event.occurredAt },
    traceId: event.traceId,
    sourceEventId: event.eventId,
    trust,
    confirmed,
    confirmationState,
    lifecycleState: event.lifecycleState,
    confidence: event.confidence,
    relationKeys: event.relatedEvents.map((relation) => `${relation.type}:${relation.eventId}`),
    tags: ['pdk4', event.eventType, event.component.toLowerCase()]
  });
}
