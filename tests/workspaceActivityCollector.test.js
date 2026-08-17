import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeFreshDataCollectHandler } from '../src/automation/runtimeFreshDataCollection.js';
import { createWorkspaceActivityCollector, WORKSPACE_ACTIVITY_CAPABILITY } from '../src/automation/workspaceActivityCollector.js';
import { WORKSPACE_ANALYTICS_INTERACTION_EVENT_TYPES } from '../src/telegramWorkspace/workspaceAnalyticsOperations.js';

function storeFixture() {
  const calls = [];
  return {
    calls,
    async countRecords(query) {
      calls.push({ method: 'countRecords', query: structuredClone(query) });
      if (query.domain === 'poll') return 4;
      if (query.domain === 'test') return 2;
      throw new Error(`unexpected count domain: ${query.domain}`);
    },
    async aggregateEventActors(query) {
      calls.push({ method: 'aggregateEventActors', query: structuredClone(query) });
      return { uniqueActors: 5, interactionEvents: 7 };
    },
    async aggregateEvents(query) {
      calls.push({ method: 'aggregateEvents', query: structuredClone(query) });
      return {
        'test.completed': 2,
        'content.published': 3,
        'poll.answer-update': 5
      };
    }
  };
}

function context(overrides = {}) {
  return {
    step: {
      type: 'collect',
      security: { protected: true },
      source: {
        capability: WORKSPACE_ACTIVITY_CAPABILITY,
        workspaceId: 'workspace:aw2.12:one',
        dataWindow: {
          from: '2026-08-17T06:00:00.000Z',
          to: '2026-08-17T07:00:00.000Z'
        }
      }
    },
    securityVerdict: { allowed: true, evidenceRefs: ['authority:workspace:current'] },
    ...overrides
  };
}

test('AW2.12 returns deterministic single-workspace activity evidence using canonical metrics', async () => {
  const store = storeFixture();
  const collect = createWorkspaceActivityCollector({ workspaceOperationsStore: store });

  const result = await collect(context());

  assert.deepEqual(result, {
    outcome: 'completed',
    data: {
      workspaceId: 'workspace:aw2.12:one',
      window: {
        from: '2026-08-17T06:00:00.000Z',
        to: '2026-08-17T07:00:00.000Z'
      },
      publications: 3,
      polls: 4,
      tests: 2,
      interactions: { uniqueActors: 5, events: 7 },
      activityEvents: {
        'content.published': 3,
        'poll.answer-update': 5,
        'test.completed': 2
      }
    },
    sourceMetadata: {
      capability: WORKSPACE_ACTIVITY_CAPABILITY,
      workspaceId: 'workspace:aw2.12:one',
      persistence: ['telegram_workspace_domain_records', 'telegram_workspace_domain_events'],
      window: {
        from: '2026-08-17T06:00:00.000Z',
        to: '2026-08-17T07:00:00.000Z'
      }
    },
    evidenceRefs: [
      'workspace:workspace:aw2.12:one:content:published',
      'workspace:workspace:aw2.12:one:poll',
      'workspace:workspace:aw2.12:one:test',
      'workspace:workspace:aw2.12:one:activity-events'
    ]
  });

  assert.deepEqual(store.calls, [
    {
      method: 'countRecords',
      query: {
        workspaceId: 'workspace:aw2.12:one',
        from: '2026-08-17T06:00:00.000Z',
        to: '2026-08-17T07:00:00.000Z',
        domain: 'poll'
      }
    },
    {
      method: 'countRecords',
      query: {
        workspaceId: 'workspace:aw2.12:one',
        from: '2026-08-17T06:00:00.000Z',
        to: '2026-08-17T07:00:00.000Z',
        domain: 'test'
      }
    },
    {
      method: 'aggregateEventActors',
      query: {
        workspaceId: 'workspace:aw2.12:one',
        from: '2026-08-17T06:00:00.000Z',
        to: '2026-08-17T07:00:00.000Z',
        eventTypes: [...WORKSPACE_ANALYTICS_INTERACTION_EVENT_TYPES]
      }
    },
    {
      method: 'aggregateEvents',
      query: {
        workspaceId: 'workspace:aw2.12:one',
        from: '2026-08-17T06:00:00.000Z',
        to: '2026-08-17T07:00:00.000Z'
      }
    }
  ]);
});

test('AW2.12 fails closed before storage reads without current allowed security', async () => {
  const store = storeFixture();
  const collect = createWorkspaceActivityCollector({ workspaceOperationsStore: store });

  await assert.rejects(
    () => collect(context({ securityVerdict: { allowed: false } })),
    (error) => error.code === 'workspace_activity_security_required' && error.retryable === false
  );
  assert.equal(store.calls.length, 0);
});

test('AW2.12 rejects wrong capability, invalid window and multi-workspace-shaped source before reads', async () => {
  const store = storeFixture();
  const collect = createWorkspaceActivityCollector({ workspaceOperationsStore: store });

  await assert.rejects(
    () => collect(context({
      step: {
        type: 'collect',
        security: { protected: true },
        source: { capability: 'other-capability', workspaceId: 'workspace:aw2.12:one' }
      }
    })),
    (error) => error.code === 'workspace_activity_capability_mismatch'
  );

  await assert.rejects(
    () => collect(context({
      step: {
        type: 'collect',
        security: { protected: true },
        source: {
          capability: WORKSPACE_ACTIVITY_CAPABILITY,
          workspaceId: 'workspace:aw2.12:one',
          dataWindow: { from: '2026-08-17T07:00:00.000Z', to: '2026-08-17T07:00:00.000Z' }
        }
      }
    })),
    /dataWindow\.from must be earlier than to/
  );

  await assert.rejects(
    () => collect(context({
      step: {
        type: 'collect',
        security: { protected: true },
        source: {
          capability: WORKSPACE_ACTIVITY_CAPABILITY,
          workspaceIds: ['workspace:aw2.12:one', 'workspace:aw2.12:two']
        }
      }
    })),
    /step\.source\.workspaceId must be a non-empty string/
  );
  assert.equal(store.calls.length, 0);
});

test('AW2.12 plugs into AW2.11 runtime collection without stale-input access', async () => {
  const store = storeFixture();
  const handler = createRuntimeFreshDataCollectHandler({
    clock: () => '2026-08-17T07:00:01.000Z',
    collectCurrent: createWorkspaceActivityCollector({ workspaceOperationsStore: store })
  });
  const step = context().step;

  const result = await handler({
    taskId: 'task:aw2.12:runtime',
    workflow: {
      automationId: 'automation:aw2.12:runtime',
      version: 1,
      scope: { globalUserId: 'user:aw2.12', projectScope: 'sg2.1', groupScope: 'workspace:aw2.12:one' },
      inputs: { stalePreparedMetric: 999999 }
    },
    step,
    stepIndex: 0,
    handoff: { previousStep: { stalePreparedMetric: 999999 } },
    securityVerdict: { allowed: true, evidenceRefs: ['authority:workspace:current'] }
  });

  assert.equal(result.outcome, 'completed');
  assert.equal(result.output.collectedAt, '2026-08-17T07:00:01.000Z');
  assert.equal(result.output.data.publications, 3);
  assert.equal(result.output.data.polls, 4);
  assert.equal(result.output.data.tests, 2);
  assert.equal(result.output.data.interactions.events, 7);
  assert.equal('stalePreparedMetric' in result.output.data, false);
  assert.deepEqual(result.evidenceRefs, [
    'workspace:workspace:aw2.12:one:content:published',
    'workspace:workspace:aw2.12:one:poll',
    'workspace:workspace:aw2.12:one:test',
    'workspace:workspace:aw2.12:one:activity-events'
  ]);
});
