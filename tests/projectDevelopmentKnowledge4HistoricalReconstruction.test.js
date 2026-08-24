import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDevelopmentSourceIdentity,
  createDevelopmentEvent,
  createDevelopmentEventProjectFactCandidate,
  createDevelopmentEventClusterer,
  createHistoricalReconstructor,
  PDK4_HISTORICAL_RECONSTRUCTION_CONTRACT_VERSION
} from '../src/projectDevelopmentKnowledge/index.js';

const projectKey = 'sg2.1';
const repository = 'korzh260609-beep/garya-bot';
const fixedClock = () => new Date('2026-08-10T18:30:00Z');

function extraction({
  hex,
  eventType = 'implementation',
  domain = 'memory',
  component = 'Project Development Knowledge 4.0',
  title,
  summary = title,
  intent = null,
  previousState = 'implementing',
  newState = 'implemented',
  occurredAt,
  verificationKind = 'code',
  lifecycleState = 'active',
  supersededBy = []
}) {
  const sha = hex.repeat(40).slice(0, 40);
  const source = createDevelopmentSourceIdentity({ kind: 'github-commit', projectKey, repository, sha });
  const event = createDevelopmentEvent({
    projectKey,
    eventType,
    domain,
    component,
    title,
    summary,
    intent,
    previousState,
    newState,
    lifecycleState,
    occurredAt,
    effectiveAt: occurredAt,
    provenance: [source],
    verification: [{ kind: verificationKind, projectKey, sourceId: source.sourceId, ref: source.fingerprint, verifiedAt: occurredAt }],
    derivedFrom: [source.sourceId],
    supersededBy,
    confidence: 0.8,
    traceId: `trace-${hex}`
  }, { clock: fixedClock });
  return Object.freeze({
    contractVersion: 1,
    event,
    candidate: createDevelopmentEventProjectFactCandidate(event, { trust: 'unverified', confirmed: false, confirmationState: 'proposed' }),
    sourceId: source.sourceId,
    normalizedFingerprint: hex.repeat(64).slice(0, 64),
    classificationFingerprint: hex.repeat(64).slice(0, 64),
    aiAssisted: false,
    trust: 'extracted-candidate',
    confirmed: false,
    authorityAllowed: false,
    extractionFingerprint: hex.repeat(64).slice(0, 64)
  });
}

async function fixture() {
  const origin = extraction({
    hex: '1',
    eventType: 'origin',
    title: 'Conceive evidence-backed SG project memory',
    summary: 'Initial verified evidence describes the idea of retaining SG development knowledge.',
    intent: 'Retain the development biography of SG.',
    previousState: 'conceived',
    newState: 'proposed',
    occurredAt: '2026-01-10T10:00:00Z',
    verificationKind: 'source'
  });
  const requirement = extraction({
    hex: '2',
    eventType: 'requirement',
    title: 'Require evidence-backed project evolution history',
    summary: 'SG should explain how its project evolved using bounded provenance.',
    intent: 'Explain project evolution with evidence.',
    previousState: 'conceived',
    newState: 'proposed',
    occurredAt: '2026-01-11T10:00:00Z',
    verificationKind: 'source'
  });
  const oldDecision = extraction({
    hex: '3',
    eventType: 'decision',
    domain: 'architecture',
    component: 'Architecture',
    title: 'Choose initial project-memory architecture',
    summary: 'An early architecture decision that was later superseded remains historical.',
    previousState: 'proposed',
    newState: 'approved',
    occurredAt: '2026-01-12T10:00:00Z',
    verificationKind: 'source',
    lifecycleState: 'superseded',
    supersededBy: ['future-decision']
  });
  const implementation = extraction({
    hex: '4',
    title: 'Implement evidence-backed historical reconstruction engine',
    summary: 'Adds bounded historical reconstruction and derived project views.',
    occurredAt: '2026-02-01T10:00:00Z'
  });
  const clustering = await createDevelopmentEventClusterer({ clock: fixedClock }).cluster([origin, requirement, oldDecision, implementation]);
  return { origin, requirement, oldDecision, implementation, extractions: [implementation, oldDecision, requirement, origin], clustering };
}

test('PDK4.7: reconstructs ProjectGenesis from earliest verified evidence without inventing creation date', async () => {
  const { origin, requirement, extractions, clustering } = await fixture();
  const result = createHistoricalReconstructor().reconstruct({ extractions, clustering, projectName: 'Советник GARYA' });

  assert.equal(result.contractVersion, PDK4_HISTORICAL_RECONSTRUCTION_CONTRACT_VERSION);
  assert.equal(result.projectKey, projectKey);
  assert.equal(result.genesis.viewType, 'project-genesis');
  assert.equal(result.genesis.projectName, 'Советник GARYA');
  assert.equal(result.genesis.originalIdea, origin.event.intent);
  assert.equal(result.genesis.originalGoal, requirement.event.intent);
  assert.equal(result.genesis.earliestVerifiedEvidence.eventId, origin.event.eventId);
  assert.equal(result.earliestKnownAt, origin.event.occurredAt);
  assert.equal(result.exactProjectCreationDateKnown, false);
  assert.match(result.creationDateQualification, /earliest verified evidence/i);
  assert.equal(result.trust, 'historical-derived');
  assert.equal(result.confirmed, false);
  assert.equal(result.authorityAllowed, false);
});

test('PDK4.7: builds chronological Product Timeline from PDK4.6 milestones with source auditability', async () => {
  const { extractions, clustering } = await fixture();
  const result = createHistoricalReconstructor().reconstruct({ extractions, clustering });
  assert.equal(result.productTimeline.viewType, 'product-timeline');
  assert.equal(result.productTimeline.events.length, clustering.clusters.length);
  const dates = result.productTimeline.events.map((entry) => Date.parse(entry.occurredAt));
  assert.deepEqual(dates, [...dates].sort((a, b) => a - b));
  assert.ok(result.productTimeline.events.every((entry) => entry.sourceIds.length >= 1));
  assert.ok(result.productTimeline.events.every((entry) => Array.isArray(entry.atomicEventIds)));
});

test('PDK4.7: builds component histories and preserves superseded atomic decisions as historical records', async () => {
  const { oldDecision, extractions, clustering } = await fixture();
  const result = createHistoricalReconstructor().reconstruct({ extractions, clustering });
  const architecture = result.componentHistories.find((view) => view.component === 'Architecture');
  assert.ok(architecture);
  const historical = architecture.events.find((entry) => entry.eventId === oldDecision.event.eventId);
  assert.ok(historical);
  assert.equal(historical.lifecycleState, 'superseded');
  assert.deepEqual(historical.supersededBy, ['future-decision']);
  assert.equal(result.genesis.initialArchitecture.eventId, oldDecision.event.eventId);
});

test('PDK4.7: identifies first working milestone only from implementation-compatible evidence', async () => {
  const { implementation, extractions, clustering } = await fixture();
  const result = createHistoricalReconstructor().reconstruct({ extractions, clustering });
  assert.ok(result.genesis.firstWorkingMilestone);
  assert.ok(result.genesis.firstWorkingMilestone.atomicEventIds.includes(implementation.event.eventId));
  assert.ok(result.genesis.firstWorkingMilestone.verificationKinds.includes('code'));
});

test('PDK4.7: reconstructs bounded development phases in historical order', async () => {
  const { extractions, clustering } = await fixture();
  const result = createHistoricalReconstructor().reconstruct({ extractions, clustering });
  assert.ok(result.developmentPhases.length >= 2);
  assert.equal(result.developmentPhases[0].phase, 'conception-decision');
  assert.ok(result.developmentPhases.some((phase) => phase.phase === 'implementation'));
  const allIds = result.developmentPhases.flatMap((phase) => phase.eventIds);
  assert.equal(allIds.length, extractions.length);
});

test('PDK4.7: replay is deterministic and does not depend on input ordering', async () => {
  const { extractions, clustering } = await fixture();
  const reconstructor = createHistoricalReconstructor();
  const a = reconstructor.reconstruct({ extractions, clustering, projectName: 'SG' });
  const b = reconstructor.reconstruct({ extractions: [...extractions].reverse(), clustering, projectName: 'SG' });
  assert.equal(a.reconstructionFingerprint, b.reconstructionFingerprint);
  assert.deepEqual(a.productTimeline, b.productTimeline);
  assert.deepEqual(a.genesis, b.genesis);
});

test('PDK4.7: cross-project, authoritative and incomplete clustering inputs fail closed', async () => {
  const { extractions, clustering } = await fixture();
  const reconstructor = createHistoricalReconstructor();
  assert.throws(
    () => reconstructor.reconstruct({ extractions: [{ ...extractions[0], confirmed: true }, ...extractions.slice(1)], clustering }),
    (error) => error.code === 'pdk4-reconstruction-extraction-denied'
  );
  assert.throws(
    () => reconstructor.reconstruct({ extractions, clustering: { ...clustering, projectKey: 'other-project' } }),
    (error) => error.code === 'pdk4-reconstruction-project-mismatch'
  );
  const incomplete = { ...clustering, clusters: clustering.clusters.slice(1) };
  assert.throws(
    () => reconstructor.reconstruct({ extractions, clustering: incomplete }),
    (error) => error.code === 'pdk4-reconstruction-unclustered-event'
  );
});

test('PDK4.7: reconstruction remains derived-only and creates no accepted PM3 facts', async () => {
  const { extractions, clustering } = await fixture();
  const result = createHistoricalReconstructor().reconstruct({ extractions, clustering });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /"confirmed":true/);
  assert.doesNotMatch(serialized, /"trust":"verified"/);
  assert.equal(result.authorityAllowed, false);
  assert.ok(Object.isFrozen(result));
});
