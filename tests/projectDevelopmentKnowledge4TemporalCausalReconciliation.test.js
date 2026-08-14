import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDevelopmentSourceIdentity,
  createDevelopmentEvent,
  createDevelopmentEventProjectFactCandidate,
  createDevelopmentEventClusterer,
  createHistoricalReconstructor,
  createTemporalCausalReconciler,
  PDK4_TEMPORAL_CAUSAL_RECONCILIATION_CONTRACT_VERSION
} from '../src/projectDevelopmentKnowledge/index.js';

const projectKey = 'sg2.1';
const repository = 'korzh260609-beep/garya-bot';
const fixedClock = () => new Date('2026-08-10T19:00:00Z');

function extraction({
  hex,
  eventType,
  component = 'PDK4.8',
  domain = 'memory',
  title,
  previousState,
  newState,
  occurredAt,
  verificationKind = 'source',
  lifecycleState = 'active',
  supersedes = [],
  supersededBy = [],
  relatedEvents = []
}) {
  const sha = hex.repeat(40).slice(0, 40);
  const source = createDevelopmentSourceIdentity({ kind: 'github-commit', projectKey, repository, sha });
  const event = createDevelopmentEvent({
    projectKey,
    eventType,
    domain,
    component,
    title,
    summary: title,
    previousState,
    newState,
    lifecycleState,
    occurredAt,
    effectiveAt: occurredAt,
    provenance: [source],
    verification: [{ kind: verificationKind, projectKey, sourceId: source.sourceId, ref: source.fingerprint, verifiedAt: occurredAt }],
    derivedFrom: [source.sourceId],
    supersedes,
    supersededBy,
    relatedEvents,
    confidence: 0.9,
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

async function prepare(extractions) {
  const clustering = await createDevelopmentEventClusterer({ clock: fixedClock }).cluster(extractions);
  const reconstruction = createHistoricalReconstructor().reconstruct({ extractions, clustering, projectName: 'SG' });
  return { clustering, reconstruction };
}

async function completeFixture() {
  const plan = extraction({
    hex: '1', eventType: 'plan', title: 'Plan PDK4 reconciliation', previousState: 'approved', newState: 'planned',
    occurredAt: '2026-08-10T10:00:00Z'
  });
  const implementation = extraction({
    hex: '2', eventType: 'implementation', title: 'Implement PDK4 reconciliation', previousState: 'implementing', newState: 'implemented',
    occurredAt: '2026-08-10T11:00:00Z', verificationKind: 'code'
  });
  const ci = extraction({
    hex: '3', eventType: 'ci-verification', title: 'Verify PDK4 reconciliation in CI', previousState: 'testing', newState: 'ci-verified',
    occurredAt: '2026-08-10T12:00:00Z', verificationKind: 'ci'
  });
  const deployment = extraction({
    hex: '4', eventType: 'deployment', title: 'Deploy PDK4 reconciliation', previousState: 'ci-verified', newState: 'deployed',
    occurredAt: '2026-08-10T13:00:00Z', verificationKind: 'deployment'
  });
  const runtime = extraction({
    hex: '5', eventType: 'runtime-verification', title: 'Verify PDK4 reconciliation live', previousState: 'deployed', newState: 'live-verified',
    occurredAt: '2026-08-10T14:00:00Z', verificationKind: 'runtime'
  });
  const extractions = [runtime, ci, plan, deployment, implementation];
  return { extractions, plan, implementation, ci, deployment, runtime, ...(await prepare(extractions)) };
}

test('PDK4.8: links implementation, CI, deployment and runtime without collapsing evidence dimensions', async () => {
  const { extractions, implementation, ci, deployment, runtime, clustering, reconstruction } = await completeFixture();
  const result = createTemporalCausalReconciler().reconcile({ extractions, clustering, reconstruction });

  assert.equal(result.contractVersion, PDK4_TEMPORAL_CAUSAL_RECONCILIATION_CONTRACT_VERSION);
  assert.equal(result.projectKey, projectKey);
  assert.ok(result.relationLinks.some((link) => link.type === 'verified-by-ci' && link.fromEventId === implementation.event.eventId && link.toEventId === ci.event.eventId));
  assert.ok(result.relationLinks.some((link) => link.type === 'deployed-as' && link.fromEventId === ci.event.eventId && link.toEventId === deployment.event.eventId));
  assert.ok(result.relationLinks.some((link) => link.type === 'verified-in-runtime' && link.fromEventId === deployment.event.eventId && link.toEventId === runtime.event.eventId));

  const component = result.componentReconciliation.find((entry) => entry.component === 'PDK4.8');
  assert.equal(component.dimensions.code.present, true);
  assert.equal(component.dimensions.ci.present, true);
  assert.equal(component.dimensions.deployment.present, true);
  assert.equal(component.dimensions.runtime.present, true);
  assert.equal(result.gaps.some((gap) => gap.gapType === 'missing-ci-evidence'), false);
  assert.equal(result.gaps.some((gap) => gap.gapType === 'missing-deployment-evidence'), false);
  assert.equal(result.gaps.some((gap) => gap.gapType === 'missing-runtime-evidence'), false);
  assert.equal(result.trust, 'reconciliation-derived');
  assert.equal(result.confirmed, false);
  assert.equal(result.authorityAllowed, false);
});

test('PDK4.8: creates explicit evidence gaps instead of promoting code to CI/deployment/runtime', async () => {
  const plan = extraction({
    hex: '6', eventType: 'plan', title: 'Plan isolated implementation', previousState: 'approved', newState: 'planned', occurredAt: '2026-08-09T10:00:00Z'
  });
  const implementation = extraction({
    hex: '7', eventType: 'implementation', title: 'Implement isolated change', previousState: 'implementing', newState: 'implemented', occurredAt: '2026-08-10T10:00:00Z', verificationKind: 'code'
  });
  const extractions = [implementation, plan];
  const { clustering, reconstruction } = await prepare(extractions);
  const result = createTemporalCausalReconciler().reconcile({ extractions, clustering, reconstruction });

  assert.ok(result.gaps.some((gap) => gap.gapType === 'missing-ci-evidence'));
  assert.ok(result.gaps.some((gap) => gap.gapType === 'stale-plan'));
  assert.ok(result.gapCandidates.every((candidate) => candidate.trust === 'unverified' && candidate.confirmed === false && candidate.confirmationState === 'proposed'));
  assert.doesNotMatch(JSON.stringify(result), /"confirmed":true/);
});

test('PDK4.8: links fixes to prior incidents and preserves explicit supersession', async () => {
  const incident = extraction({
    hex: '8', eventType: 'incident', title: 'Observe reconciliation defect', previousState: 'implementing', newState: 'implemented', occurredAt: '2026-08-10T09:00:00Z', verificationKind: 'code'
  });
  const fix = extraction({
    hex: '9', eventType: 'fix', title: 'Fix reconciliation defect', previousState: 'implementing', newState: 'implemented', occurredAt: '2026-08-10T10:00:00Z', verificationKind: 'code'
  });
  const oldDecision = extraction({
    hex: 'a', eventType: 'decision', title: 'Use old reconciliation rule', previousState: 'proposed', newState: 'approved', occurredAt: '2026-08-10T11:00:00Z', lifecycleState: 'superseded', supersededBy: ['new-decision']
  });
  const newDecision = extraction({
    hex: 'b', eventType: 'decision', title: 'Use new reconciliation rule', previousState: 'proposed', newState: 'approved', occurredAt: '2026-08-10T12:00:00Z', supersedes: [oldDecision.event.eventId]
  });
  const rewrittenOld = {
    ...oldDecision,
    event: { ...oldDecision.event, supersededBy: Object.freeze([newDecision.event.eventId]) }
  };
  const extractions = [incident, fix, rewrittenOld, newDecision];
  // Recreate candidate after the bounded fixture rewrite so input stays self-consistent.
  extractions[2] = Object.freeze({ ...rewrittenOld, candidate: createDevelopmentEventProjectFactCandidate(rewrittenOld.event, { trust: 'unverified', confirmed: false, confirmationState: 'proposed' }) });
  const { clustering, reconstruction } = await prepare(extractions);
  const result = createTemporalCausalReconciler().reconcile({ extractions, clustering, reconstruction });

  assert.ok(result.relationLinks.some((link) => link.type === 'fixes' && link.fromEventId === fix.event.eventId && link.toEventId === incident.event.eventId));
  assert.ok(result.relationLinks.some((link) => link.type === 'supersedes' && link.fromEventId === newDecision.event.eventId && link.toEventId === oldDecision.event.eventId));
  assert.equal(result.gaps.some((gap) => gap.gapType === 'missing-supersession' && gap.eventIds.includes(oldDecision.event.eventId)), false);
});

test('PDK4.8: missing supersession target becomes an explicit gap rather than invented history', async () => {
  const oldDecision = extraction({
    hex: 'c', eventType: 'decision', title: 'Historical decision with absent replacement', previousState: 'proposed', newState: 'approved', occurredAt: '2026-08-10T10:00:00Z', lifecycleState: 'superseded', supersededBy: ['missing-event-id']
  });
  const extractions = [oldDecision];
  const { clustering, reconstruction } = await prepare(extractions);
  const result = createTemporalCausalReconciler().reconcile({ extractions, clustering, reconstruction });
  assert.ok(result.gaps.some((gap) => gap.gapType === 'missing-supersession' && gap.eventIds.includes('missing-event-id')));
});

test('PDK4.8: contradictory evidence chronology remains visible', async () => {
  const ci = extraction({
    hex: 'd', eventType: 'ci-verification', title: 'Earlier CI evidence', previousState: 'testing', newState: 'ci-verified', occurredAt: '2026-08-10T10:00:00Z', verificationKind: 'ci'
  });
  const code = extraction({
    hex: 'e', eventType: 'implementation', title: 'Later implementation evidence', previousState: 'implementing', newState: 'implemented', occurredAt: '2026-08-10T11:00:00Z', verificationKind: 'code'
  });
  const extractions = [code, ci];
  const { clustering, reconstruction } = await prepare(extractions);
  const result = createTemporalCausalReconciler().reconcile({ extractions, clustering, reconstruction });
  assert.ok(result.contradictions.some((gap) => gap.gapType === 'temporal-evidence-order' && gap.dimension === 'code→ci'));
});

test('PDK4.8: reconciliation fingerprint is deterministic across extraction input ordering', async () => {
  const { extractions, clustering, reconstruction } = await completeFixture();
  const reconciler = createTemporalCausalReconciler();
  const a = reconciler.reconcile({ extractions, clustering, reconstruction });
  const b = reconciler.reconcile({ extractions: [...extractions].reverse(), clustering, reconstruction });
  assert.equal(a.reconciliationFingerprint, b.reconciliationFingerprint);
  assert.deepEqual(a.relationLinks, b.relationLinks);
  assert.deepEqual(a.gaps, b.gaps);
});

test('PDK4.8: cross-project, authoritative and mismatched historical inputs fail closed', async () => {
  const { extractions, clustering, reconstruction } = await completeFixture();
  const reconciler = createTemporalCausalReconciler();
  assert.throws(
    () => reconciler.reconcile({ extractions: [{ ...extractions[0], confirmed: true }, ...extractions.slice(1)], clustering, reconstruction }),
    (error) => error.code === 'pdk4-reconciliation-extraction-denied'
  );
  assert.throws(
    () => reconciler.reconcile({ extractions, clustering: { ...clustering, projectKey: 'other-project' }, reconstruction }),
    (error) => error.code === 'pdk4-reconciliation-clustering-denied'
  );
  assert.throws(
    () => reconciler.reconcile({ extractions, clustering, reconstruction: { ...reconstruction, atomicEventCount: 999 } }),
    (error) => error.code === 'pdk4-reconciliation-history-mismatch'
  );
});
