import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeFreshDataCollectHandler } from '../src/automation/runtimeFreshDataCollection.js';
import { createWorkspaceActivityCollector, WORKSPACE_ACTIVITY_CAPABILITY } from '../src/automation/workspaceActivityCollector.js';
import { WORKSPACE_ANALYTICS_INTERACTION_EVENT_TYPES } from '../src/telegramWorkspace/workspaceAnalyticsOperations.js';

const WORKSPACE_ID = 'tgw_aw212one';

function storeFixture() {
  const calls = [];
  return {
    calls,
    async countRecords(query) {
      calls.push(['countRecords', structuredClone(query)]);
      if (query.domain === 'poll') return 4;
      if (query.domain === 'test') return 2;
      throw new Error(`unexpected domain: ${query.domain}`);
    },
    async aggregateEventActors(query) {
      calls.push(['aggregateEventActors', structuredClone(query)]);
      return { uniqueActors: 5, interactionEvents: 7 };
    },
    async aggregateEvents(query) {
      calls.push(['aggregateEvents', structuredClone(query)]);
      return { 'test.completed': 2, 'content.published': 3, 'poll.answer-update': 5 };
    }
  };
}

function collectContext(source = {}) {
  return {
    step: {
      type: 'collect',
      security: { protected: true },
      source: {
        capability: WORKSPACE_ACTIVITY_CAPABILITY,
        workspaceId: WORKSPACE_ID,
        dataWindow: { from: '2026-08-17T06:00:00.000Z', to: '2026-08-17T07:00:00.000Z' },
        ...source
      }
    },
    securityVerdict: { allowed: true }
  };
}

test('AW2.12 returns deterministic single-workspace activity evidence', async () => {
  const store = storeFixture();
  const result = await createWorkspaceActivityCollector({ workspaceOperationsStore: store })(collectContext());

  assert.equal(result.data.workspaceId, WORKSPACE_ID);
  assert.deepEqual(result.data.window, { from: '2026-08-17T06:00:00.000Z', to: '2026-08-17T07:00:00.000Z' });
  assert.equal(result.data.publications, 3);
  assert.equal(result.data.polls, 4);
  assert.equal(result.data.tests, 2);
  assert.deepEqual(result.data.interactions, { uniqueActors: 5, events: 7 });
  assert.deepEqual(result.data.activityEvents, {
    'content.published': 3,
    'poll.answer-update': 5,
    'test.completed': 2
  });
  assert.deepEqual(result.evidenceRefs, [
    `workspace:${WORKSPACE_ID}:content:published`,
    `workspace:${WORKSPACE_ID}:poll`,
    `workspace:${WORKSPACE_ID}:test`,
    `workspace:${WORKSPACE_ID}:activity-events`
  ]);
  assert.deepEqual(store.calls.map(([method]) => method), [
    'countRecords', 'countRecords', 'aggregateEventActors', 'aggregateEvents'
  ]);
  assert.deepEqual(store.calls[0][1], { workspaceId: WORKSPACE_ID, from: '2026-08-17T06:00:00.000Z', to: '2026-08-17T07:00:00.000Z', domain: 'poll' });
  assert.deepEqual(store.calls[1][1], { workspaceId: WORKSPACE_ID, from: '2026-08-17T06:00:00.000Z', to: '2026-08-17T07:00:00.000Z', domain: 'test' });
  assert.deepEqual(store.calls[2][1].eventTypes, [...WORKSPACE_ANALYTICS_INTERACTION_EVENT_TYPES]);
});

test('AW2.12 fails closed before reads without current allowed security', async () => {
  const store = storeFixture();
  const collect = createWorkspaceActivityCollector({ workspaceOperationsStore: store });
  await assert.rejects(
    () => collect({ ...collectContext(), securityVerdict: { allowed: false } }),
    (error) => error.code === 'workspace_activity_security_required' && error.retryable === false
  );
  assert.equal(store.calls.length, 0);
});

test('AW2.12 validates canonical window and single workspace before reads', async () => {
  const store = storeFixture();
  const collect = createWorkspaceActivityCollector({ workspaceOperationsStore: store });
  await assert.rejects(
    () => collect(collectContext({ dataWindow: { from: '2026-08-17T07:00:00.000Z', to: '2026-08-17T07:00:00.000Z' } })),
    /dataWindow\.from must be earlier than to/
  );
  await assert.rejects(
    () => collect({
      ...collectContext(),
      step: { type: 'collect', security: { protected: true }, source: { capability: WORKSPACE_ACTIVITY_CAPABILITY, workspaceIds: [WORKSPACE_ID, 'tgw_aw212two'] } }
    }),
    /workspaceId is required/
  );
  await assert.rejects(
    () => collect(collectContext({ workspaceId: 'not-canonical' })),
    (error) => error.code === 'twm-cross-workspace-denied'
  );
  assert.equal(store.calls.length, 0);
});

test('AW2.12 composes with AW2.11 fresh runtime collection', async () => {
  const store = storeFixture();
  const handler = createRuntimeFreshDataCollectHandler({
    clock: () => '2026-08-17T07:00:01.000Z',
    collectCurrent: createWorkspaceActivityCollector({ workspaceOperationsStore: store })
  });
  const result = await handler({
    taskId: 'task:aw212',
    workflow: { automationId: 'automation:aw212', version: 1, scope: { globalUserId: 'user:aw212', groupScope: WORKSPACE_ID }, inputs: { stale: 999 } },
    step: collectContext().step,
    stepIndex: 0,
    handoff: { stale: 999 },
    securityVerdict: { allowed: true }
  });
  assert.equal(result.outcome, 'completed');
  assert.equal(result.output.collectedAt, '2026-08-17T07:00:01.000Z');
  assert.equal(result.output.data.publications, 3);
  assert.equal('stale' in result.output.data, false);
});