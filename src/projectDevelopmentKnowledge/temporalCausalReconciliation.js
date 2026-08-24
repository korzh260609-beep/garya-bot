import { createHash } from 'node:crypto';

export const PDK4_TEMPORAL_CAUSAL_RECONCILIATION_CONTRACT_VERSION = 1;
export const PDK4_RECONCILIATION_LIMITS = Object.freeze({
  maxEvents: 5000,
  maxRelations: 20000,
  maxGaps: 5000,
  maxComponents: 256
});

export const PDK4_KNOWLEDGE_GAP_TYPES = Object.freeze([
  'missing-supersession',
  'stale-plan',
  'missing-ci-evidence',
  'missing-deployment-evidence',
  'missing-runtime-evidence',
  'missing-causal-link',
  'temporal-evidence-order'
]);

const RELATION_TYPES = new Set([
  'originates-from','motivated-by','proposes','rejects','approved-as','implements','refines','refactors','migrates-from','fixes','caused-by','verified-by-test','verified-by-ci','deployed-as','verified-in-runtime','supersedes','superseded-by','depends-on','blocks','unblocks','belongs-to-milestone','next-after'
]);
const MOTIVATORS = new Set(['origin','requirement','problem','proposal','decision','rationale','bug','incident','root-cause']);
const IMPLEMENTERS = new Set(['implementation','refactor','rework','migration']);
const FIXERS = new Set(['fix']);
const PLAN_TYPES = new Set(['plan','next-plan']);
const DECISION_TYPES = new Set(['decision','proposal','plan']);
const IMPLEMENTED_STATES = new Set(['implemented','testing','ci-verified','deployed','live-verified','closed']);
const TERMINAL_PLAN_STATES = new Set(['rejected','abandoned','superseded','deprecated','closed']);
const EVIDENCE_DIMENSIONS = Object.freeze(['source','code','test','ci','deployment','runtime']);

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function sha256(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function normalizeComponent(value) { return String(value ?? '').trim().toLowerCase(); }
function orderedEvents(extractions) {
  return [...extractions].sort((a, b) => Date.parse(a.event.occurredAt) - Date.parse(b.event.occurredAt)
    || Date.parse(a.event.effectiveAt) - Date.parse(b.event.effectiveAt)
    || a.event.eventId.localeCompare(b.event.eventId));
}
function assertExtraction(entry, projectKey = null) {
  if (!entry || entry.trust !== 'extracted-candidate' || entry.confirmed !== false || entry.authorityAllowed !== false) {
    fail('pdk4-reconciliation-extraction-denied', 'PDK4.8 accepts only non-authoritative PDK4.5 extracted candidates');
  }
  if (!entry.event || entry.candidate?.factType !== 'project-event' || entry.candidate?.trust !== 'unverified' || entry.candidate?.confirmed !== false || entry.candidate?.confirmationState !== 'proposed') {
    fail('pdk4-reconciliation-candidate-denied', 'PDK4.8 requires unverified proposed PM3 project-event candidates');
  }
  if (projectKey && entry.event.projectKey !== projectKey) fail('pdk4-reconciliation-project-mismatch', 'PDK4.8 cannot reconcile across projects');
  if (!Array.isArray(entry.event.provenance) || entry.event.provenance.length === 0 || !Array.isArray(entry.event.verification)) {
    fail('pdk4-reconciliation-evidence-required', 'PDK4.8 requires provenance-backed event evidence');
  }
}
function assertClustering(clustering, projectKey, eventIds) {
  if (!clustering || clustering.projectKey !== projectKey || clustering.trust !== 'clustering-derived' || clustering.confirmed !== false || clustering.authorityAllowed !== false) {
    fail('pdk4-reconciliation-clustering-denied', 'PDK4.8 requires matching non-authoritative PDK4.6 clustering');
  }
  const seen = new Set();
  for (const cluster of clustering.clusters ?? []) {
    if (cluster.trust !== 'cluster-candidate' || cluster.confirmed !== false || cluster.authorityAllowed !== false || cluster.candidate?.trust !== 'unverified') {
      fail('pdk4-reconciliation-cluster-denied', 'PDK4.8 accepts only non-authoritative milestone clusters');
    }
    for (const id of cluster.atomicEventIds ?? []) {
      if (!eventIds.has(id)) fail('pdk4-reconciliation-unknown-event', 'cluster references unknown atomic event');
      if (seen.has(id)) fail('pdk4-reconciliation-duplicate-cluster-link', 'atomic event appears in multiple clusters');
      seen.add(id);
    }
  }
  if (seen.size !== eventIds.size) fail('pdk4-reconciliation-unclustered-event', 'every atomic event must remain represented by clustering');
}
function assertReconstruction(reconstruction, projectKey, eventCount, clusterCount) {
  if (!reconstruction || reconstruction.projectKey !== projectKey || reconstruction.trust !== 'historical-derived' || reconstruction.confirmed !== false || reconstruction.authorityAllowed !== false) {
    fail('pdk4-reconciliation-history-denied', 'PDK4.8 requires matching non-authoritative PDK4.7 reconstruction');
  }
  if (reconstruction.atomicEventCount !== eventCount || reconstruction.milestoneCount !== clusterCount || typeof reconstruction.reconstructionFingerprint !== 'string') {
    fail('pdk4-reconciliation-history-mismatch', 'PDK4.7 reconstruction does not match PDK4.5/PDK4.6 inputs');
  }
}
function sameScope(a, b) {
  return a.projectKey === b.projectKey && a.domain === b.domain && normalizeComponent(a.component) === normalizeComponent(b.component);
}
function priorMatching(events, index, predicate) {
  const current = events[index];
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = events[i];
    if (sameScope(current, candidate) && predicate(candidate)) return candidate;
  }
  return null;
}
function laterMatching(events, index, predicate) {
  const current = events[index];
  for (let i = index + 1; i < events.length; i += 1) {
    const candidate = events[i];
    if (sameScope(current, candidate) && predicate(candidate)) return candidate;
  }
  return null;
}
function hasEvidence(event, kind) { return (event.verification ?? []).some((entry) => entry.kind === kind); }
function relationRecord({ projectKey, type, fromEventId, toEventId, component, basis }) {
  const canonical = { projectKey, type, fromEventId, toEventId, component, basis };
  return deepFreeze({
    relationId: `pdk4_rel_${sha256(stable(canonical)).slice(0, 32)}`,
    ...canonical,
    trust: 'derived-link',
    confirmed: false,
    authorityAllowed: false
  });
}
function gapRecord({ projectKey, gapType, component, dimension = null, eventIds = [], summary, severity = 'evidence-gap' }) {
  const ids = [...new Set(eventIds)].sort();
  const canonical = { projectKey, gapType, component, dimension, eventIds: ids, summary, severity };
  return deepFreeze({
    gapId: `pdk4_gap_${sha256(stable(canonical)).slice(0, 32)}`,
    ...canonical,
    eventIds: Object.freeze(ids),
    status: 'open',
    trust: 'gap-derived',
    confirmed: false,
    authorityAllowed: false
  });
}
function gapCandidate(gap) {
  return deepFreeze({
    candidateType: 'development-knowledge-gap',
    projectKey: gap.projectKey,
    entityKey: gap.gapId,
    gap,
    trust: 'unverified',
    confirmed: false,
    confirmationState: 'proposed',
    authorityAllowed: false
  });
}
function pushRelation(target, seen, input, limits) {
  if (!RELATION_TYPES.has(input.type) || input.fromEventId === input.toEventId) return;
  const key = `${input.type}:${input.fromEventId}:${input.toEventId}`;
  if (seen.has(key)) return;
  if (target.length >= limits.maxRelations) fail('pdk4-reconciliation-relation-limit', 'PDK4.8 relation limit exceeded');
  seen.add(key);
  target.push(relationRecord(input));
}
function pushGap(target, seen, input, limits) {
  const gap = gapRecord(input);
  if (seen.has(gap.gapId)) return;
  if (target.length >= limits.maxGaps) fail('pdk4-reconciliation-gap-limit', 'PDK4.8 gap limit exceeded');
  seen.add(gap.gapId);
  target.push(gap);
}
function buildDimensions(events) {
  const byComponent = new Map();
  for (const event of events) {
    const key = event.component;
    if (!byComponent.has(key)) byComponent.set(key, []);
    byComponent.get(key).push(event);
  }
  return [...byComponent.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([component, entries]) => {
    const dimensions = {};
    for (const kind of EVIDENCE_DIMENSIONS) {
      const matches = entries.filter((event) => hasEvidence(event, kind));
      const latest = matches.at(-1) ?? null;
      dimensions[kind] = Object.freeze({
        present: matches.length > 0,
        latestAt: latest?.effectiveAt ?? null,
        eventIds: Object.freeze(matches.map((event) => event.eventId))
      });
    }
    return deepFreeze({ component, dimensions });
  });
}
function addTemporalEvidenceOrderGaps(projectKey, componentDimensions, gaps, gapSeen, limits) {
  for (const entry of componentDimensions) {
    const { code, ci, deployment, runtime } = entry.dimensions;
    const pairs = [[code, ci, 'code→ci'], [ci, deployment, 'ci→deployment'], [deployment, runtime, 'deployment→runtime']];
    for (const [lower, higher, label] of pairs) {
      if (lower.present && higher.present && Date.parse(higher.latestAt) < Date.parse(lower.latestAt)) {
        pushGap(gaps, gapSeen, {
          projectKey,
          gapType: 'temporal-evidence-order',
          component: entry.component,
          dimension: label,
          eventIds: [...lower.eventIds, ...higher.eventIds],
          summary: `Evidence chronology is contradictory for ${label}: stronger-dimension evidence predates the latest prerequisite evidence.`,
          severity: 'contradiction'
        }, limits);
      }
    }
  }
}

export function createTemporalCausalReconciler({ limits: limitOverrides = {} } = {}) {
  const limits = Object.freeze({ ...PDK4_RECONCILIATION_LIMITS, ...limitOverrides });
  if (!Number.isInteger(limits.maxEvents) || limits.maxEvents < 1 || limits.maxEvents > 20000) throw new TypeError('maxEvents must be an integer between 1 and 20000');

  function reconcile({ extractions, clustering, reconstruction } = {}) {
    if (!Array.isArray(extractions) || extractions.length === 0) throw new TypeError('extractions must contain at least one PDK4.5 result');
    if (extractions.length > limits.maxEvents) fail('pdk4-reconciliation-event-limit', 'PDK4.8 event limit exceeded');
    const projectKey = extractions[0]?.event?.projectKey;
    for (const entry of extractions) assertExtraction(entry, projectKey);
    const eventIds = new Set(extractions.map((entry) => entry.event.eventId));
    if (eventIds.size !== extractions.length) fail('pdk4-reconciliation-duplicate-event', 'duplicate atomic event id is not allowed');
    assertClustering(clustering, projectKey, eventIds);
    assertReconstruction(reconstruction, projectKey, extractions.length, clustering.clusters.length);

    const events = orderedEvents(extractions).map((entry) => entry.event);
    const byId = new Map(events.map((event) => [event.eventId, event]));
    const relations = [];
    const relationSeen = new Set();
    const gaps = [];
    const gapSeen = new Set();

    for (const cluster of clustering.clusters) {
      for (const link of cluster.relationLinks ?? []) {
        if (eventIds.has(link.fromEventId) && link.toEventId === cluster.milestone.eventId) {
          pushRelation(relations, relationSeen, { projectKey, type: 'belongs-to-milestone', fromEventId: link.fromEventId, toEventId: link.toEventId, component: cluster.milestone.component, basis: 'pdk4.6-explicit' }, limits);
        }
      }
    }

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const previousSame = priorMatching(events, index, () => true);
      if (previousSame) pushRelation(relations, relationSeen, { projectKey, type: 'next-after', fromEventId: event.eventId, toEventId: previousSame.eventId, component: event.component, basis: 'deterministic-temporal-order' }, limits);

      for (const explicit of event.relatedEvents ?? []) {
        if (!eventIds.has(explicit.eventId)) {
          pushGap(gaps, gapSeen, { projectKey, gapType: 'missing-causal-link', component: event.component, eventIds: [event.eventId, explicit.eventId], summary: `Explicit ${explicit.type} relation references an event absent from the reconciled history.` }, limits);
        } else {
          pushRelation(relations, relationSeen, { projectKey, type: explicit.type, fromEventId: event.eventId, toEventId: explicit.eventId, component: event.component, basis: 'explicit-event-relation' }, limits);
        }
      }

      const motivator = priorMatching(events, index, (candidate) => MOTIVATORS.has(candidate.eventType));
      if (motivator && (IMPLEMENTERS.has(event.eventType) || FIXERS.has(event.eventType) || PLAN_TYPES.has(event.eventType) || event.eventType === 'decision')) {
        pushRelation(relations, relationSeen, { projectKey, type: 'motivated-by', fromEventId: event.eventId, toEventId: motivator.eventId, component: event.component, basis: 'bounded-prior-motivator' }, limits);
      }
      if (IMPLEMENTERS.has(event.eventType)) {
        const target = priorMatching(events, index, (candidate) => ['plan','decision','requirement','proposal'].includes(candidate.eventType));
        if (target) pushRelation(relations, relationSeen, { projectKey, type: 'implements', fromEventId: event.eventId, toEventId: target.eventId, component: event.component, basis: 'bounded-prior-plan-decision' }, limits);
      }
      if (FIXERS.has(event.eventType)) {
        const target = priorMatching(events, index, (candidate) => ['bug','incident','root-cause'].includes(candidate.eventType));
        if (target) pushRelation(relations, relationSeen, { projectKey, type: 'fixes', fromEventId: event.eventId, toEventId: target.eventId, component: event.component, basis: 'bounded-prior-failure' }, limits);
      }

      for (const oldId of event.supersedes ?? []) {
        if (eventIds.has(oldId)) {
          pushRelation(relations, relationSeen, { projectKey, type: 'supersedes', fromEventId: event.eventId, toEventId: oldId, component: event.component, basis: 'explicit-supersedes' }, limits);
          pushRelation(relations, relationSeen, { projectKey, type: 'superseded-by', fromEventId: oldId, toEventId: event.eventId, component: event.component, basis: 'explicit-supersedes-reverse' }, limits);
        } else {
          pushGap(gaps, gapSeen, { projectKey, gapType: 'missing-supersession', component: event.component, eventIds: [event.eventId, oldId], summary: 'Supersession references a target event absent from the reconciled history.' }, limits);
        }
      }
      for (const newId of event.supersededBy ?? []) {
        if (eventIds.has(newId)) {
          pushRelation(relations, relationSeen, { projectKey, type: 'superseded-by', fromEventId: event.eventId, toEventId: newId, component: event.component, basis: 'explicit-superseded-by' }, limits);
          pushRelation(relations, relationSeen, { projectKey, type: 'supersedes', fromEventId: newId, toEventId: event.eventId, component: event.component, basis: 'explicit-superseded-by-reverse' }, limits);
        } else {
          pushGap(gaps, gapSeen, { projectKey, gapType: 'missing-supersession', component: event.component, eventIds: [event.eventId, newId], summary: 'Superseded historical event names a replacement absent from the reconciled history.' }, limits);
        }
      }

      if (hasEvidence(event, 'code') || IMPLEMENTED_STATES.has(event.newState)) {
        const ci = laterMatching(events, index, (candidate) => candidate.eventType === 'ci-verification' || hasEvidence(candidate, 'ci'));
        if (ci) pushRelation(relations, relationSeen, { projectKey, type: 'verified-by-ci', fromEventId: event.eventId, toEventId: ci.eventId, component: event.component, basis: 'later-ci-evidence' }, limits);
      }
      if (hasEvidence(event, 'ci') || event.newState === 'ci-verified') {
        const deployment = laterMatching(events, index, (candidate) => candidate.eventType === 'deployment' || hasEvidence(candidate, 'deployment'));
        if (deployment) pushRelation(relations, relationSeen, { projectKey, type: 'deployed-as', fromEventId: event.eventId, toEventId: deployment.eventId, component: event.component, basis: 'later-deployment-evidence' }, limits);
      }
      if (hasEvidence(event, 'deployment') || event.newState === 'deployed') {
        const runtime = laterMatching(events, index, (candidate) => candidate.eventType === 'runtime-verification' || hasEvidence(candidate, 'runtime'));
        if (runtime) pushRelation(relations, relationSeen, { projectKey, type: 'verified-in-runtime', fromEventId: event.eventId, toEventId: runtime.eventId, component: event.component, basis: 'later-runtime-evidence' }, limits);
      }
    }

    const componentReconciliation = buildDimensions(events);
    if (componentReconciliation.length > limits.maxComponents) fail('pdk4-reconciliation-component-limit', 'PDK4.8 component limit exceeded');

    for (const entry of componentReconciliation) {
      const componentEvents = events.filter((event) => event.component === entry.component);
      const dims = entry.dimensions;
      if (dims.code.present && !dims.ci.present) pushGap(gaps, gapSeen, { projectKey, gapType: 'missing-ci-evidence', component: entry.component, dimension: 'ci', eventIds: dims.code.eventIds, summary: 'Implementation/code evidence exists, but no CI evidence is present. Implemented and CI-verified remain distinct.' }, limits);
      if (dims.ci.present && !dims.deployment.present) pushGap(gaps, gapSeen, { projectKey, gapType: 'missing-deployment-evidence', component: entry.component, dimension: 'deployment', eventIds: dims.ci.eventIds, summary: 'CI evidence exists, but no deployment evidence is present. CI-verified and deployed remain distinct.' }, limits);
      if (dims.deployment.present && !dims.runtime.present) pushGap(gaps, gapSeen, { projectKey, gapType: 'missing-runtime-evidence', component: entry.component, dimension: 'runtime', eventIds: dims.deployment.eventIds, summary: 'Deployment evidence exists, but no runtime evidence is present. Deployed and live-verified remain distinct.' }, limits);

      for (const plan of componentEvents.filter((event) => PLAN_TYPES.has(event.eventType) && !TERMINAL_PLAN_STATES.has(event.newState) && event.lifecycleState === 'active')) {
        const laterDelivery = componentEvents.find((event) => Date.parse(event.effectiveAt) > Date.parse(plan.effectiveAt) && (hasEvidence(event, 'code') || hasEvidence(event, 'ci') || hasEvidence(event, 'deployment') || hasEvidence(event, 'runtime')));
        if (laterDelivery) pushGap(gaps, gapSeen, { projectKey, gapType: 'stale-plan', component: entry.component, dimension: 'source/code', eventIds: [plan.eventId, laterDelivery.eventId], summary: 'An active plan predates later delivery evidence and has no explicit close/supersession marker.' }, limits);
      }

      const activeDecisions = componentEvents.filter((event) => DECISION_TYPES.has(event.eventType) && event.lifecycleState === 'active' && !TERMINAL_PLAN_STATES.has(event.newState));
      for (let i = 1; i < activeDecisions.length; i += 1) {
        const older = activeDecisions[i - 1];
        const newer = activeDecisions[i];
        const explicitlyLinked = (newer.supersedes ?? []).includes(older.eventId) || (older.supersededBy ?? []).includes(newer.eventId);
        if (!explicitlyLinked) pushGap(gaps, gapSeen, { projectKey, gapType: 'missing-supersession', component: entry.component, dimension: 'decision-history', eventIds: [older.eventId, newer.eventId], summary: 'Multiple successive active decision/plan records exist without explicit supersession.' }, limits);
      }
    }

    addTemporalEvidenceOrderGaps(projectKey, componentReconciliation, gaps, gapSeen, limits);

    relations.sort((a, b) => a.type.localeCompare(b.type) || a.fromEventId.localeCompare(b.fromEventId) || a.toEventId.localeCompare(b.toEventId));
    gaps.sort((a, b) => a.gapType.localeCompare(b.gapType) || a.component.localeCompare(b.component) || a.gapId.localeCompare(b.gapId));
    const contradictions = gaps.filter((gap) => gap.severity === 'contradiction');
    const reconciliationFingerprint = sha256(stable({
      projectKey,
      reconstructionFingerprint: reconstruction.reconstructionFingerprint,
      eventFingerprints: events.map((event) => event.semanticFingerprint),
      clusteringFingerprint: clustering.clusteringFingerprint,
      relationIds: relations.map((relation) => relation.relationId),
      gapIds: gaps.map((gap) => gap.gapId)
    }));

    return deepFreeze({
      contractVersion: PDK4_TEMPORAL_CAUSAL_RECONCILIATION_CONTRACT_VERSION,
      projectKey,
      relationLinks: Object.freeze(relations),
      componentReconciliation: Object.freeze(componentReconciliation),
      gaps: Object.freeze(gaps),
      gapCandidates: Object.freeze(gaps.map(gapCandidate)),
      contradictions: Object.freeze(contradictions),
      trust: 'reconciliation-derived',
      confirmed: false,
      authorityAllowed: false,
      reconciliationFingerprint
    });
  }

  return Object.freeze({ reconcile });
}
