import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDevelopmentSourceIdentity,
  createDevelopmentEvent,
  createDevelopmentEventProjectFactCandidate,
  createDevelopmentEventClusterer,
  PDK4_CLUSTERING_CONTRACT_VERSION
} from '../src/projectDevelopmentKnowledge/index.js';

const projectKey = 'sg2.1';
const repository = 'korzh260609-beep/garya-bot';
const fixedClock = () => new Date('2026-08-10T18:00:00Z');

function extraction({
  sha,
  title,
  summary = title,
  component = 'Project Development Knowledge 4.0',
  domain = 'memory',
  occurredAt = '2026-08-10T16:00:00Z',
  project = projectKey,
  traceId = `trace-${sha.slice(0, 8)}`
}) {
  const source = createDevelopmentSourceIdentity({ kind: 'github-commit', projectKey: project, repository, sha });
  const event = createDevelopmentEvent({
    projectKey: project,
    eventType: 'implementation',
    domain,
    component,
    title,
    summary,
    implementation: summary,
    previousState: 'implementing',
    newState: 'implemented',
    occurredAt,
    effectiveAt: occurredAt,
    provenance: [source],
    verification: [{ kind: 'code', projectKey: project, sourceId: source.sourceId, ref: source.fingerprint, verifiedAt: occurredAt }],
    derivedFrom: [source.sourceId],
    confidence: 0.8,
    traceId
  }, { clock: fixedClock });
  const candidate = createDevelopmentEventProjectFactCandidate(event, { trust: 'unverified', confirmed: false, confirmationState: 'proposed' });
  return Object.freeze({
    contractVersion: 1,
    event,
    candidate,
    sourceId: source.sourceId,
    normalizedFingerprint: sha.repeat(2).slice(0, 64),
    classificationFingerprint: sha.split('').reverse().join('').repeat(2).slice(0, 64),
    aiAssisted: false,
    trust: 'extracted-candidate',
    confirmed: false,
    authorityAllowed: false,
    extractionFingerprint: sha.padEnd(64, '0').slice(0, 64)
  });
}

function workflowSupport(eventId) {
  const sourceId = 'pdk4:workflow-source';
  const normalizedFingerprint = 'f'.repeat(64);
  return Object.freeze({
    source: Object.freeze({
      contractVersion: 1,
      projectKey,
      kind: 'github-workflow',
      repository,
      sourceId,
      sourceFingerprint: 'e'.repeat(64),
      immutableIdentity: Object.freeze({ kind: 'github-workflow', projectKey, repository, runId: '7088', attempt: 1, sourceId, fingerprint: 'e'.repeat(64) }),
      occurredAt: '2026-08-10T17:00:00Z',
      evidenceDimension: 'ci',
      verificationKinds: Object.freeze(['ci', 'source']),
      trust: 'verified-source',
      contentMode: 'untrusted-data-only',
      payload: Object.freeze({ runId: '7088', conclusion: 'success' }),
      normalizedFingerprint
    }),
    classification: Object.freeze({
      contractVersion: 1,
      projectKey,
      sourceId,
      normalizedFingerprint,
      significance: 'supporting-evidence',
      retain: true,
      eventEligible: false,
      categories: Object.freeze(['infrastructure']),
      trust: 'classification-only',
      authorityAllowed: false,
      classificationFingerprint: 'd'.repeat(64)
    }),
    relatedEventIds: Object.freeze([eventId])
  });
}

test('PDK4.6: correlated multi-commit implementation becomes one auditable milestone candidate', async () => {
  const first = extraction({
    sha: '1'.repeat(40),
    title: 'Add commit event clustering milestone correlation',
    occurredAt: '2026-08-10T15:00:00Z'
  });
  const second = extraction({
    sha: '2'.repeat(40),
    title: 'Refine event clustering milestone correlation tests',
    occurredAt: '2026-08-10T16:00:00Z'
  });
  const clusterer = createDevelopmentEventClusterer({ clock: fixedClock });
  const result = await clusterer.cluster([second, first]);

  assert.equal(result.contractVersion, PDK4_CLUSTERING_CONTRACT_VERSION);
  assert.equal(result.atomicEventCount, 2);
  assert.equal(result.clusterCount, 1);
  assert.equal(result.trust, 'clustering-derived');
  assert.equal(result.confirmed, false);
  const cluster = result.clusters[0];
  assert.equal(cluster.milestone.eventType, 'milestone');
  assert.deepEqual(cluster.atomicEventIds, [first.event.eventId, second.event.eventId]);
  assert.equal(cluster.milestone.provenance.length, 2);
  assert.equal(cluster.relationLinks.length, 2);
  assert.ok(cluster.relationLinks.every((link) => link.type === 'belongs-to-milestone' && link.toEventId === cluster.milestone.eventId));
  assert.equal(cluster.candidate.factType, 'project-event');
  assert.equal(cluster.candidate.trust, 'unverified');
  assert.equal(cluster.candidate.confirmed, false);
  assert.equal(cluster.candidate.confirmationState, 'proposed');
  assert.equal(cluster.authorityAllowed, false);
});

test('PDK4.6: semantic similarity cannot collapse distinct product changes', async () => {
  const memoryChange = extraction({ sha: '3'.repeat(40), title: 'cluster commit milestone history' });
  const unrelated = extraction({ sha: '4'.repeat(40), title: 'harden webhook signature validation transport' });
  const result = await createDevelopmentEventClusterer({ clock: fixedClock }).cluster([memoryChange, unrelated]);
  assert.equal(result.clusterCount, 2);
  assert.deepEqual(result.clusters.map((item) => item.atomicEventIds.length), [1, 1]);
});

test('PDK4.6: component/domain/time hard boundaries prevent accidental merges', async () => {
  const base = extraction({ sha: '5'.repeat(40), title: 'cluster event evidence milestone' });
  const otherComponent = extraction({ sha: '6'.repeat(40), title: 'cluster event evidence milestone', component: 'Identity & Scope', domain: 'identity' });
  const distant = extraction({ sha: '7'.repeat(40), title: 'cluster event evidence milestone', occurredAt: '2026-09-20T16:00:00Z' });
  const result = await createDevelopmentEventClusterer({ clock: fixedClock }).cluster([base, otherComponent, distant]);
  assert.equal(result.clusterCount, 3);
});

test('PDK4.6: supporting CI evidence attaches for audit but cannot promote milestone lifecycle state', async () => {
  const event = extraction({ sha: '8'.repeat(40), title: 'add clustering milestone implementation' });
  const support = workflowSupport(event.event.eventId);
  const result = await createDevelopmentEventClusterer({ clock: fixedClock }).cluster([event], { supportingEvidence: [support] });
  const cluster = result.clusters[0];
  assert.deepEqual(cluster.supportingSourceIds, ['pdk4:workflow-source']);
  assert.equal(cluster.milestone.newState, 'implemented');
  assert.deepEqual(cluster.milestone.verification.map((item) => item.kind), ['code']);
  assert.doesNotMatch(JSON.stringify(cluster.candidate), /"kind":"ci"/);
});

test('PDK4.6: supporting evidence must explicitly link to a known atomic event', async () => {
  const event = extraction({ sha: '9'.repeat(40), title: 'add clustering milestone implementation' });
  const support = workflowSupport('unknown-event');
  await assert.rejects(
    () => createDevelopmentEventClusterer({ clock: fixedClock }).cluster([event], { supportingEvidence: [support] }),
    (error) => error.code === 'pdk4-clustering-support-link-required'
  );
});

test('PDK4.6: cross-project and authoritative/mutated extraction inputs fail closed', async () => {
  const first = extraction({ sha: 'a'.repeat(40), title: 'cluster commit milestone' });
  const otherProject = extraction({ sha: 'b'.repeat(40), title: 'cluster commit milestone', project: 'other-project' });
  await assert.rejects(
    () => createDevelopmentEventClusterer({ clock: fixedClock }).cluster([first, otherProject]),
    (error) => error.code === 'pdk4-clustering-project-mismatch'
  );
  await assert.rejects(
    () => createDevelopmentEventClusterer({ clock: fixedClock }).cluster([{ ...first, confirmed: true }]),
    (error) => error.code === 'pdk4-clustering-extraction-denied'
  );
});

test('PDK4.6: AI Router is used only for ambiguous compatible pairs and cannot confirm milestone truth', async () => {
  const calls = [];
  const first = extraction({ sha: 'c'.repeat(40), title: 'cluster commit milestone' });
  const second = extraction({ sha: 'd'.repeat(40), title: 'cluster workflow evidence' });
  const clusterer = createDevelopmentEventClusterer({
    clock: fixedClock,
    aiRouter: {
      async route(input) {
        calls.push(input);
        return { text: JSON.stringify({ merge: true, confirmed: true, authority: 'owner', newState: 'live-verified' }) };
      }
    }
  });
  const result = await clusterer.cluster([first, second], { traceContext: { traceId: 'trace-pdk46-ai' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].metadata.purpose, 'pdk4-development-event-clustering');
  assert.equal(calls[0].metadata.pdk4DataOnly, true);
  assert.equal(calls[0].metadata.pdk4CanConfirm, false);
  assert.equal(calls[0].metadata.pdk4AuthorityAllowed, false);
  assert.equal(result.clusterCount, 1);
  assert.equal(result.clusters[0].aiAssisted, true);
  assert.equal(result.clusters[0].confirmed, false);
  assert.equal(result.clusters[0].candidate.trust, 'unverified');
  assert.equal(result.clusters[0].candidate.confirmationState, 'proposed');
  assert.notEqual(result.clusters[0].milestone.newState, 'live-verified');
});

test('PDK4.6: malformed/unavailable AI falls back to deterministic split and replay-stable fingerprints', async () => {
  const first = extraction({ sha: 'e'.repeat(40), title: 'cluster commit milestone' });
  const second = extraction({ sha: 'f'.repeat(40), title: 'cluster workflow evidence' });
  const malformed = createDevelopmentEventClusterer({ clock: fixedClock, aiRouter: { async route() { return { text: 'not-json' }; } } });
  const unavailable = createDevelopmentEventClusterer({ clock: fixedClock, aiRouter: { async route() { throw new Error('provider unavailable'); } } });
  const a = await malformed.cluster([first, second]);
  const b = await unavailable.cluster([first, second]);
  const c = await malformed.cluster([first, second]);
  assert.equal(a.clusterCount, 2);
  assert.equal(b.clusterCount, 2);
  assert.equal(a.clusteringFingerprint, c.clusteringFingerprint);
  assert.deepEqual(a.clusters.map((item) => item.clusterFingerprint), c.clusters.map((item) => item.clusterFingerprint));
});
