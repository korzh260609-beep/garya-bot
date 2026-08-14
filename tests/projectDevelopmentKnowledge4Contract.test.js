import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDK4_EVENT_TYPES,
  PDK4_DEVELOPMENT_STATES,
  PDK4_RELATION_TYPES,
  PDK4_DERIVED_VIEW_TYPES,
  createDevelopmentSourceIdentity,
  createDevelopmentEvent,
  createProjectGenesisView,
  createProductTimelineView,
  createComponentHistoryView,
  createProjectSnapshotView,
  createDevelopmentEventProjectFactCandidate
} from '../src/projectDevelopmentKnowledge/index.js';

const CLOCK = () => new Date('2026-08-10T15:00:00.000Z');

function source(overrides = {}) {
  return createDevelopmentSourceIdentity({
    kind: 'github-commit',
    projectKey: 'sg2.1',
    repository: 'korzh260609-beep/garya-bot',
    sha: '726bd635da1157267db87e141a5b83c2c8f20a45',
    ...overrides
  });
}

function baseEvent(overrides = {}) {
  return {
    projectKey: 'sg2.1',
    eventType: 'implementation',
    domain: 'memory',
    component: 'Project Development Knowledge 4.0',
    title: 'Implement PDK4.1 contract',
    summary: 'Adds strict development-event contracts and taxonomy.',
    intent: 'Create the executable PDK4 foundation.',
    previousState: 'implementing',
    newState: 'implemented',
    occurredAt: '2026-08-10T14:59:00.000Z',
    provenance: [source()],
    verification: [{ kind: 'code', projectKey: 'sg2.1', sourceId: source().sourceId }],
    traceId: 'trace-pdk41-1',
    ...overrides
  };
}

test('PDK4.1: taxonomy contains canonical event, state, relation and view types', () => {
  for (const value of ['origin','decision','implementation','ci-verification','deployment','runtime-verification','current-state','next-plan']) assert.ok(PDK4_EVENT_TYPES.includes(value));
  for (const value of ['conceived','implemented','ci-verified','deployed','live-verified','superseded']) assert.ok(PDK4_DEVELOPMENT_STATES.includes(value));
  for (const value of ['motivated-by','implements','verified-by-ci','deployed-as','verified-in-runtime','supersedes']) assert.ok(PDK4_RELATION_TYPES.includes(value));
  assert.deepEqual(PDK4_DERIVED_VIEW_TYPES, ['project-genesis','product-timeline','component-history','project-snapshot']);
});

test('PDK4.1: source identity and fingerprint are deterministic', () => {
  const a = source();
  const b = source();
  assert.equal(a.sourceId, b.sourceId);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.match(a.fingerprint, /^[a-f0-9]{64}$/);
});

test('PDK4.1: canonical DevelopmentEvent is strict, immutable and project scoped', () => {
  const event = createDevelopmentEvent(baseEvent(), { clock: CLOCK });
  assert.equal(event.projectKey, 'sg2.1');
  assert.equal(event.eventType, 'implementation');
  assert.equal(event.domain, 'memory');
  assert.equal(event.previousState, 'implementing');
  assert.equal(event.newState, 'implemented');
  assert.equal(event.createdAt, '2026-08-10T15:00:00.000Z');
  assert.match(event.eventId, /^dev_evt_[a-f0-9]{32}$/);
  assert.match(event.semanticFingerprint, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.provenance));
});

test('PDK4.1: cross-project provenance and relations fail closed', () => {
  assert.throws(
    () => createDevelopmentEvent(baseEvent({ provenance: [source({ projectKey: 'other' })] }), { clock: CLOCK }),
    (error) => error.code === 'pdk4-project-scope-denied'
  );
  assert.throws(
    () => createDevelopmentEvent(baseEvent({ relatedEvents: [{ type: 'implements', eventId: 'dev_evt_other', projectKey: 'other' }] }), { clock: CLOCK }),
    (error) => error.code === 'pdk4-project-scope-denied'
  );
});

test('PDK4.1: secret, authority and private-user payloads are rejected recursively', () => {
  for (const overrides of [
    { implementation: { api_key: 'secret' } },
    { result: { roles: ['owner'] } },
    { rationale: { nested: { global_user_id: 'usr_x' } } },
    { limitations: [{ email: 'private@example.test' }] }
  ]) {
    assert.throws(() => createDevelopmentEvent(baseEvent(overrides), { clock: CLOCK }), /PDK4 cannot carry/);
  }
});

test('PDK4.1: invalid lifecycle/state promotion is rejected', () => {
  assert.throws(
    () => createDevelopmentEvent(baseEvent({ previousState: 'planned', newState: 'live-verified', verification: [{ kind: 'runtime', projectKey: 'sg2.1', ref: 'live' }] }), { clock: CLOCK }),
    (error) => error.code === 'pdk4-invalid-state-transition'
  );
  assert.throws(
    () => createDevelopmentEvent(baseEvent({ previousState: 'implemented', newState: 'ci-verified', verification: [] }), { clock: CLOCK }),
    (error) => error.code === 'pdk4-state-evidence-required'
  );
  assert.throws(
    () => createDevelopmentEvent(baseEvent({ previousState: 'ci-verified', newState: 'deployed', verification: [{ kind: 'ci', projectKey: 'sg2.1' }] }), { clock: CLOCK }),
    (error) => error.code === 'pdk4-state-evidence-required'
  );
  assert.throws(
    () => createDevelopmentEvent(baseEvent({ previousState: 'deployed', newState: 'live-verified', verification: [{ kind: 'deployment', projectKey: 'sg2.1' }] }), { clock: CLOCK }),
    (error) => error.code === 'pdk4-state-evidence-required'
  );
});

test('PDK4.1: stronger states require their own evidence dimension', () => {
  const ci = createDevelopmentEvent(baseEvent({
    previousState: 'implemented',
    newState: 'ci-verified',
    verification: [{ kind: 'ci', projectKey: 'sg2.1', ref: 'SG 2.1 CI #7041' }]
  }), { clock: CLOCK });
  assert.equal(ci.newState, 'ci-verified');

  const deployed = createDevelopmentEvent(baseEvent({
    previousState: 'ci-verified',
    newState: 'deployed',
    verification: [{ kind: 'deployment', projectKey: 'sg2.1', ref: 'deploy:example' }]
  }), { clock: CLOCK });
  assert.equal(deployed.newState, 'deployed');
});

test('PDK4.1: supersession requires explicit successor', () => {
  assert.throws(
    () => createDevelopmentEvent(baseEvent({
      previousState: 'implemented',
      newState: 'superseded',
      lifecycleState: 'superseded',
      verification: [{ kind: 'code', projectKey: 'sg2.1' }]
    }), { clock: CLOCK }),
    (error) => error.code === 'pdk4-supersession-target-required'
  );
});

test('PDK4.1: derived views remain bounded, project-scoped and non-authoritative', () => {
  const genesis = createProjectGenesisView({ projectKey: 'sg2.1', projectName: 'SG 2.1', originalGoal: 'Advisor platform', derivedFrom: ['dev_evt_1'] });
  const timeline = createProductTimelineView({ projectKey: 'sg2.1', events: [{ eventId: 'dev_evt_1' }] });
  const component = createComponentHistoryView({ projectKey: 'sg2.1', component: 'Memory 2.0', events: [{ eventId: 'dev_evt_2' }] });
  const snapshot = createProjectSnapshotView({ projectKey: 'sg2.1', sourceRevision: 'abc', implemented: ['Memory 2.0'], ciVerified: [] }, { clock: CLOCK });
  assert.equal(genesis.viewType, 'project-genesis');
  assert.equal(timeline.viewType, 'product-timeline');
  assert.equal(component.viewType, 'component-history');
  assert.equal(snapshot.viewType, 'project-snapshot');
  assert.deepEqual(snapshot.deployed, []);
  assert.deepEqual(snapshot.liveVerified, []);
  assert.throws(() => createProjectSnapshotView({ projectKey: 'sg2.1', risks: [{ permissions: ['*'] }] }, { clock: CLOCK }), /PDK4 cannot carry authority/);
});

test('PDK4.1: DevelopmentEvent maps to a PM3 candidate, not a parallel memory record', () => {
  const event = createDevelopmentEvent(baseEvent(), { clock: CLOCK });
  const candidate = createDevelopmentEventProjectFactCandidate(event);
  assert.equal(candidate.layer, 'project-memory');
  assert.equal(candidate.projectKey, 'sg2.1');
  assert.equal(candidate.namespace, 'project.sg2.1.memory');
  assert.equal(candidate.factType, 'project-event');
  assert.equal(candidate.entityKey, event.eventId);
  assert.equal(candidate.confirmed, false);
  assert.equal(candidate.confirmationState, 'proposed');
  assert.equal(candidate.trust, 'unverified');
  assert.equal(candidate.fact.newState, 'implemented');
});
