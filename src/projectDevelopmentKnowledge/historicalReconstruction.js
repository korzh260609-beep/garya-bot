import { createHash } from 'node:crypto';
import {
  createProjectGenesisView,
  createProductTimelineView,
  createComponentHistoryView
} from './developmentKnowledgeContract.js';

export const PDK4_HISTORICAL_RECONSTRUCTION_CONTRACT_VERSION = 1;
export const PDK4_HISTORICAL_RECONSTRUCTION_LIMITS = Object.freeze({
  maxEvents: 5000,
  maxTimelineEvents: 1000,
  maxComponents: 128,
  maxComponentEvents: 1000,
  maxFoundationalDecisions: 24,
  maxEvolutionMilestones: 200,
  maxTitleChars: 240,
  maxSummaryChars: 1200
});

const WORKING_STATES = new Set(['implemented', 'testing', 'ci-verified', 'deployed', 'live-verified', 'closed']);
const WORKING_EVIDENCE = new Set(['code', 'test', 'ci', 'deployment', 'runtime']);
const CONCEPTION_TYPES = new Set(['origin', 'requirement', 'proposal', 'decision', 'rationale', 'alternative']);
const IMPLEMENTATION_TYPES = new Set(['implementation', 'refactor', 'rework', 'migration', 'bug', 'incident', 'root-cause', 'fix']);
const VERIFICATION_TYPES = new Set(['test', 'ci-verification', 'result']);
const EVOLUTION_TYPES = new Set(['superseded', 'rejected', 'abandoned']);

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
function bounded(value, limit) {
  const text = value == null ? '' : String(value).trim();
  return text ? text.slice(0, limit) : null;
}
function orderedByTime(entries, selector) {
  return [...entries].sort((left, right) => {
    const a = selector(left);
    const b = selector(right);
    return Date.parse(a.occurredAt) - Date.parse(b.occurredAt)
      || Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt)
      || a.eventId.localeCompare(b.eventId);
  });
}
function assertExtraction(entry, projectKey = null) {
  if (!entry || entry.trust !== 'extracted-candidate' || entry.confirmed !== false || entry.authorityAllowed !== false) {
    fail('pdk4-reconstruction-extraction-denied', 'PDK4.7 accepts only non-authoritative PDK4.5 extracted candidates');
  }
  if (!entry.event || entry.candidate?.factType !== 'project-event' || entry.candidate?.trust !== 'unverified' || entry.candidate?.confirmed !== false || entry.candidate?.confirmationState !== 'proposed') {
    fail('pdk4-reconstruction-candidate-denied', 'PDK4.7 requires unverified proposed PM3 project-event candidates');
  }
  if (projectKey && entry.event.projectKey !== projectKey) {
    fail('pdk4-reconstruction-project-mismatch', 'PDK4.7 cannot reconstruct across projects');
  }
  if (!Array.isArray(entry.event.provenance) || entry.event.provenance.length === 0 || !Array.isArray(entry.event.verification) || entry.event.verification.length === 0) {
    fail('pdk4-reconstruction-evidence-required', 'PDK4.7 requires provenance-backed verified source evidence');
  }
}
function assertClustering(clustering, projectKey, extractionIds) {
  if (!clustering || clustering.trust !== 'clustering-derived' || clustering.confirmed !== false || clustering.authorityAllowed !== false) {
    fail('pdk4-reconstruction-clustering-denied', 'PDK4.7 requires non-authoritative PDK4.6 clustering output');
  }
  if (clustering.projectKey !== projectKey) {
    fail('pdk4-reconstruction-project-mismatch', 'PDK4.6 clustering belongs to another project');
  }
  if (!Array.isArray(clustering.clusters) || clustering.clusters.length === 0) {
    fail('pdk4-reconstruction-clustering-required', 'PDK4.7 requires at least one PDK4.6 cluster');
  }
  const seen = new Set();
  for (const cluster of clustering.clusters) {
    if (!cluster || cluster.trust !== 'cluster-candidate' || cluster.confirmed !== false || cluster.authorityAllowed !== false) {
      fail('pdk4-reconstruction-cluster-denied', 'PDK4.7 accepts only non-authoritative milestone cluster candidates');
    }
    if (cluster.milestone?.projectKey !== projectKey || cluster.milestone?.eventType !== 'milestone') {
      fail('pdk4-reconstruction-cluster-invalid', 'PDK4.7 requires project-scoped milestone events');
    }
    if (cluster.candidate?.trust !== 'unverified' || cluster.candidate?.confirmed !== false || cluster.candidate?.confirmationState !== 'proposed') {
      fail('pdk4-reconstruction-cluster-candidate-denied', 'milestone candidate must remain unverified and proposed');
    }
    for (const eventId of cluster.atomicEventIds ?? []) {
      if (!extractionIds.has(eventId)) fail('pdk4-reconstruction-unknown-event', 'cluster references an unknown atomic event');
      if (seen.has(eventId)) fail('pdk4-reconstruction-duplicate-cluster-link', 'atomic event appears in more than one milestone cluster');
      seen.add(eventId);
    }
  }
  if (seen.size !== extractionIds.size) {
    fail('pdk4-reconstruction-unclustered-event', 'every atomic event must be represented by exactly one milestone cluster');
  }
}
function sourceSummary(event) {
  return Object.freeze({
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    sourceIds: Object.freeze(event.provenance.map((source) => source.sourceId).sort()),
    verificationKinds: Object.freeze([...new Set(event.verification.map((item) => item.kind))].sort()),
    qualification: 'earliest-verified-evidence-not-project-creation-date'
  });
}
function firstCommitEvidence(events) {
  for (const event of events) {
    const source = event.provenance.find((item) => item.kind === 'github-commit');
    if (source) {
      return Object.freeze({
        eventId: event.eventId,
        occurredAt: event.occurredAt,
        sourceId: source.sourceId,
        repository: source.repository ?? null,
        sha: source.sha ?? null
      });
    }
  }
  return null;
}
function eventSnapshot(event, limits) {
  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    component: event.component,
    title: bounded(event.title, limits.maxTitleChars),
    summary: bounded(event.summary, limits.maxSummaryChars),
    previousState: event.previousState,
    newState: event.newState,
    lifecycleState: event.lifecycleState,
    occurredAt: event.occurredAt,
    effectiveAt: event.effectiveAt,
    sourceIds: Object.freeze(event.provenance.map((source) => source.sourceId).sort()),
    verificationKinds: Object.freeze([...new Set(event.verification.map((item) => item.kind))].sort()),
    supersedes: Object.freeze([...(event.supersedes ?? [])]),
    supersededBy: Object.freeze([...(event.supersededBy ?? [])])
  });
}
function milestoneSnapshot(cluster, limits) {
  const milestone = cluster.milestone;
  return Object.freeze({
    eventId: milestone.eventId,
    eventType: 'milestone',
    component: milestone.component,
    title: bounded(milestone.title, limits.maxTitleChars),
    summary: bounded(milestone.summary, limits.maxSummaryChars),
    previousState: milestone.previousState,
    newState: milestone.newState,
    lifecycleState: milestone.lifecycleState,
    occurredAt: milestone.occurredAt,
    effectiveAt: milestone.effectiveAt,
    atomicEventIds: Object.freeze([...(cluster.atomicEventIds ?? [])]),
    sourceIds: Object.freeze(milestone.provenance.map((source) => source.sourceId).sort()),
    supportingSourceIds: Object.freeze([...(cluster.supportingSourceIds ?? [])]),
    verificationKinds: Object.freeze([...new Set(milestone.verification.map((item) => item.kind))].sort())
  });
}
function phaseFor(event) {
  if (EVOLUTION_TYPES.has(event.eventType) || ['superseded', 'deprecated', 'rejected'].includes(event.newState)) return 'evolution';
  if (event.eventType === 'deployment' || event.eventType === 'runtime-verification' || ['deployed', 'live-verified'].includes(event.newState)) return 'deployment-runtime';
  if (VERIFICATION_TYPES.has(event.eventType) || ['testing', 'ci-verified'].includes(event.newState)) return 'verification';
  if (event.eventType === 'plan' || event.eventType === 'next-plan' || event.newState === 'planned') return 'planning';
  if (IMPLEMENTATION_TYPES.has(event.eventType) || ['implementing', 'implemented'].includes(event.newState)) return 'implementation';
  if (CONCEPTION_TYPES.has(event.eventType) || ['conceived', 'proposed', 'approved'].includes(event.newState)) return 'conception-decision';
  return 'other';
}
function buildPhases(events) {
  const phases = [];
  for (const event of events) {
    const phase = phaseFor(event);
    const last = phases.at(-1);
    if (last?.phase === phase) {
      last.endedAt = event.effectiveAt;
      last.eventIds.push(event.eventId);
    } else {
      phases.push({ phase, startedAt: event.occurredAt, endedAt: event.effectiveAt, eventIds: [event.eventId] });
    }
  }
  return Object.freeze(phases.map((phase) => deepFreeze({ ...phase, eventIds: Object.freeze(phase.eventIds) })));
}
function originalFields(events) {
  const origin = events.find((event) => event.eventType === 'origin') ?? null;
  const requirement = events.find((event) => event.eventType === 'requirement') ?? null;
  return {
    originalIdea: origin ? bounded(origin.intent ?? origin.summary, 1200) : null,
    originalGoal: requirement
      ? bounded(requirement.intent ?? requirement.summary, 1200)
      : origin ? bounded(origin.intent ?? origin.summary, 1200) : null
  };
}
function initialArchitecture(events, limits) {
  const event = events.find((item) => item.domain === 'architecture' || /architecture/i.test(item.component));
  return event ? eventSnapshot(event, limits) : null;
}
function foundationalDecisions(events, limits) {
  return Object.freeze(events
    .filter((event) => ['decision', 'rationale'].includes(event.eventType))
    .slice(0, limits.maxFoundationalDecisions)
    .map((event) => eventSnapshot(event, limits)));
}
function firstWorkingMilestone(clusters, limits) {
  const ordered = [...clusters].sort((a, b) => Date.parse(a.milestone.occurredAt) - Date.parse(b.milestone.occurredAt) || a.milestone.eventId.localeCompare(b.milestone.eventId));
  for (const cluster of ordered) {
    const kinds = new Set(cluster.milestone.verification.map((item) => item.kind));
    if (WORKING_STATES.has(cluster.milestone.newState) && [...kinds].some((kind) => WORKING_EVIDENCE.has(kind))) {
      return milestoneSnapshot(cluster, limits);
    }
  }
  return null;
}
function buildComponentHistories(projectKey, events, clusters, limits) {
  const components = new Map();
  function push(component, entry) {
    if (!components.has(component)) components.set(component, []);
    components.get(component).push(entry);
  }
  for (const event of events) push(event.component, eventSnapshot(event, limits));
  for (const cluster of clusters) push(cluster.milestone.component, milestoneSnapshot(cluster, limits));
  if (components.size > limits.maxComponents) fail('pdk4-reconstruction-component-limit', 'component history limit exceeded');
  const result = [];
  for (const component of [...components.keys()].sort()) {
    const entries = components.get(component)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.eventId.localeCompare(b.eventId));
    if (entries.length > limits.maxComponentEvents) fail('pdk4-reconstruction-component-event-limit', 'component event limit exceeded');
    result.push(createComponentHistoryView({ projectKey, component, events: entries }));
  }
  return Object.freeze(result);
}

export function createHistoricalReconstructor({ limits: limitOverrides = {} } = {}) {
  const limits = Object.freeze({ ...PDK4_HISTORICAL_RECONSTRUCTION_LIMITS, ...limitOverrides });
  if (!Number.isInteger(limits.maxEvents) || limits.maxEvents < 1 || limits.maxEvents > 20000) throw new TypeError('maxEvents must be an integer between 1 and 20000');
  if (!Number.isInteger(limits.maxTimelineEvents) || limits.maxTimelineEvents < 1 || limits.maxTimelineEvents > 5000) throw new TypeError('maxTimelineEvents must be an integer between 1 and 5000');

  function reconstruct({ extractions, clustering, projectName = null } = {}) {
    if (!Array.isArray(extractions) || extractions.length === 0) throw new TypeError('extractions must contain at least one PDK4.5 result');
    if (extractions.length > limits.maxEvents) fail('pdk4-reconstruction-event-limit', 'historical reconstruction event limit exceeded');
    const projectKey = extractions[0]?.event?.projectKey;
    for (const extraction of extractions) assertExtraction(extraction, projectKey);
    const extractionIds = new Set(extractions.map((entry) => entry.event.eventId));
    if (extractionIds.size !== extractions.length) fail('pdk4-reconstruction-duplicate-event', 'duplicate atomic event id is not allowed');
    assertClustering(clustering, projectKey, extractionIds);

    const events = orderedByTime(extractions, (entry) => entry.event).map((entry) => entry.event);
    const clusters = [...clustering.clusters].sort((a, b) => Date.parse(a.milestone.occurredAt) - Date.parse(b.milestone.occurredAt) || a.milestone.eventId.localeCompare(b.milestone.eventId));
    const earliest = events[0];
    const originals = originalFields(events);
    const timelineEntries = clusters.slice(0, limits.maxTimelineEvents).map((cluster) => milestoneSnapshot(cluster, limits));
    const evolutionMilestones = timelineEntries.slice(0, limits.maxEvolutionMilestones);
    const decisions = foundationalDecisions(events, limits);

    const genesis = createProjectGenesisView({
      projectKey,
      projectName: bounded(projectName, 240),
      originalIdea: originals.originalIdea,
      originalGoal: originals.originalGoal,
      earliestVerifiedEvidence: sourceSummary(earliest),
      firstRelevantCommit: firstCommitEvidence(events),
      initialArchitecture: initialArchitecture(events, limits),
      firstWorkingMilestone: firstWorkingMilestone(clusters, limits),
      foundationalDecisions: decisions,
      earlyLimitations: [],
      majorEvolutionMilestones: evolutionMilestones,
      derivedFrom: Object.freeze(events.flatMap((event) => event.provenance.map((source) => source.sourceId)))
    });
    const productTimeline = createProductTimelineView({ projectKey, events: timelineEntries });
    const componentHistories = buildComponentHistories(projectKey, events, clusters, limits);
    const developmentPhases = buildPhases(events);
    const reconstructionFingerprint = sha256(stable({
      projectKey,
      projectName: projectName ?? null,
      eventFingerprints: events.map((event) => event.semanticFingerprint),
      clusterFingerprints: clusters.map((cluster) => cluster.clusterFingerprint),
      timelineEventIds: timelineEntries.map((event) => event.eventId)
    }));

    return deepFreeze({
      contractVersion: PDK4_HISTORICAL_RECONSTRUCTION_CONTRACT_VERSION,
      projectKey,
      genesis,
      productTimeline,
      componentHistories,
      developmentPhases,
      earliestKnownAt: earliest.occurredAt,
      exactProjectCreationDateKnown: false,
      creationDateQualification: 'PDK4.7 records earliest verified evidence and does not infer an exact project creation date.',
      atomicEventCount: events.length,
      milestoneCount: clusters.length,
      trust: 'historical-derived',
      confirmed: false,
      authorityAllowed: false,
      reconstructionFingerprint
    });
  }

  return Object.freeze({ reconstruct });
}
