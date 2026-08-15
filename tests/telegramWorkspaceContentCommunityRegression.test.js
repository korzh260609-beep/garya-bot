import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWorkspaceActionGateIntegration } from '../src/telegramWorkspace/telegramWorkspaceActionGateIntegration.js';
import { createWorkspaceContentOperations } from '../src/telegramWorkspace/workspaceContentOperations.js';
import { createWorkspaceAnalyticsOperations } from '../src/telegramWorkspace/workspaceAnalyticsOperations.js';
import { createTelegramWorkspacePollUpdateHandler } from '../src/telegramWorkspace/telegramWorkspacePollUpdateHandler.js';
import { createTelegramProductionIntegration, createInMemoryTelegramUpdateStore } from '../src/telegram/telegramProductionIntegration.js';

test('TWM domain mutations remain inside canonical Action Gate and workspace Resource Authority', async () => {
  let captured = null;
  const integration = createTelegramWorkspaceActionGateIntegration({
    actionGate: {
      evaluate(request) {
        captured = request;
        return Object.freeze({ outcome: 'allow', reasons: ['test-allow'], requiresConfirmation: false, actionRequest: request, effectiveActionClass: request.actionClass });
      }
    },
    projectScope: 'sg2.1'
  });

  const decision = await integration.evaluateDomainMutation({
    operation: 'content.publish',
    domain: 'content',
    recordId: 'content_1',
    workspaceId: 'telegram:workspace:100',
    actorGlobalUserId: 'user:owner',
    traceId: 'trace-1',
    requestId: 'request-1',
    risk: 'medium',
    confirmationRequired: true,
    confirmation: { confirmed: true, requestId: 'request-1' },
    requiredPermission: 'workspace:publish',
    authority: {
      allowed: true,
      workspaceRole: 'administrator',
      reason: 'telegram-admin-verified',
      verificationTime: '2026-08-15T12:00:00.000Z'
    }
  });

  assert.equal(decision.outcome, 'allow');
  assert.equal(captured.scope.groupScope, 'telegram:workspace:100');
  assert.equal(captured.scope.requestedGroupScope, 'telegram:workspace:100');
  assert.equal(captured.requiredPermission, 'workspace:publish');
  assert.equal(captured.resourceAuthority.allowed, true);
  assert.equal(captured.resourceAuthority.resourceId, 'telegram:workspace:100');
  assert.equal(captured.resourceAuthority.requiredRelation, 'workspace:publish');
  assert.equal(captured.actor.authenticationLevel, 'verified');
});

test('scheduled publication rechecks fresh publish authority and denies after admin rights are lost', async () => {
  let authorized = true;
  const authorityCalls = [];
  const core = {
    store: {
      async getRecord({ workspaceId, domain, recordId }) {
        assert.equal(workspaceId, 'telegram:workspace:100');
        assert.equal(domain, 'content');
        assert.equal(recordId, 'content_1');
        return { recordId, status: 'scheduled', payload: { kind: 'text', text: 'scheduled' }, version: 1 };
      }
    },
    project: 'sg2.1',
    workspace: async () => ({ telegramChatId: '-1001', workspaceType: 'supergroup' }),
    capabilities: async () => ({ allowed: true }),
    gate: async (_ctx, _operation, work) => work({}),
    async authority(ctx, action, fresh) {
      authorityCalls.push({ ...ctx, action, fresh });
      if (!authorized) throw Object.assign(new Error('admin rights lost'), { code: 'twm-authority-denied' });
      return { allowed: true };
    }
  };
  const content = createWorkspaceContentOperations({ core });
  const request = {
    kind: 'telegram-workspace-content-publish',
    groupScope: 'telegram:workspace:100',
    actorGlobalUserId: 'user:owner',
    payload: {
      source: 'telegram-workspace-content-schedule-v1',
      workspaceId: 'telegram:workspace:100',
      contentId: 'content_1',
      actorGlobalUserId: 'user:owner',
      telegramUserId: '42'
    }
  };

  assert.equal((await content.authorizeScheduled(request)).outcome, 'allow');
  authorized = false;
  const denied = await content.authorizeScheduled(request);
  assert.equal(denied.outcome, 'deny');
  assert.equal(denied.reason, 'twm-authority-denied');
  assert.equal(authorityCalls.length, 2);
  assert.equal(authorityCalls.every((call) => call.action === 'workspace:publish' && call.fresh === true), true);
});

test('poll_answer is tied to canonical identity without persisting raw Telegram user id', async () => {
  let event = null;
  const operationsService = {
    core: {
      store: {
        async findPollByTelegramId(id) {
          assert.equal(id, 'poll-tg-1');
          return { workspaceId: 'telegram:workspace:100', recordId: 'poll_1' };
        },
        async appendEvent(input) {
          event = input;
          return { inserted: true, deduplicated: false };
        }
      }
    },
    async ingestTelegramPollUpdate() { return { handled: true }; }
  };
  const handler = createTelegramWorkspacePollUpdateHandler({
    operationsService,
    projectScope: 'sg2.1',
    identityResolver: async (facts) => {
      assert.equal(facts.platformFacts.platformUserId, '777');
      return { identityContext: { globalUserId: 'user:canonical-777' } };
    }
  });

  const result = await handler.handleUpdate({
    poll_answer: {
      poll_id: 'poll-tg-1',
      user: { id: 777, first_name: 'Member', username: 'member777' },
      option_ids: [1]
    }
  }, 12345);

  assert.equal(result.handled, true);
  assert.equal(event.actorGlobalUserId, 'user:canonical-777');
  assert.deepEqual(event.evidence.optionIds, [1]);
  assert.equal(event.evidence.identityResolved, true);
  assert.equal(JSON.stringify(event.evidence).includes('777'), false);
  assert.equal(typeof event.evidence.voterRef, 'string');
  assert.equal(event.evidence.voterRef.length, 64);
});

test('workspace analytics contains only deterministic persisted counts and labels AI narrative non-authoritative', async () => {
  const saved = [];
  const core = {
    authority: async (_ctx, action) => {
      assert.equal(action, 'workspace:view');
      return { allowed: true };
    },
    gate: async (_ctx, _operation, work) => work({}),
    store: {
      async aggregateEvents({ workspaceId }) {
        assert.equal(workspaceId, 'telegram:workspace:100');
        return { 'poll.statistics': 2, 'content.published': 3 };
      },
      async countRecords({ domain }) {
        return domain === 'content' ? 4 : domain === 'poll' ? 1 : 0;
      },
      async saveAnalyticsSnapshot(input) {
        saved.push(input);
        return { snapshotId: 'analytics_1', ...input };
      }
    }
  };
  const analytics = createWorkspaceAnalyticsOperations({
    core,
    aiAnalyze: async () => 'Interpretation only'
  });
  const ctx = { workspaceId: 'telegram:workspace:100', actorGlobalUserId: 'user:owner', telegramUserId: '42' };
  const snapshot = await analytics.snapshot(ctx, {});
  assert.equal(snapshot.metrics.recordCounts.content, 4);
  assert.equal(snapshot.metrics.recordCounts.poll, 1);
  assert.equal(snapshot.metrics.eventCounts['poll.statistics'], 2);
  assert.equal(snapshot.metrics.totalStructuredEvents, 5);
  assert.deepEqual(Object.keys(snapshot.metrics).sort(), ['eventCounts', 'recordCounts', 'totalStructuredEvents']);
  assert.equal(saved.length, 1);

  const analyzed = await analytics.analyze(ctx, { snapshot });
  assert.equal(analyzed.authoritativeMetrics, true);
  assert.equal(analyzed.aiAuthoritative, false);
  assert.equal(analyzed.narrative, 'Interpretation only');
});

test('production Telegram webhook routes poll updates after secret verification and dedupe without invoking chat runtime', async () => {
  const updateStore = createInMemoryTelegramUpdateStore();
  let pollCalls = 0;
  let runtimeCalls = 0;
  const integration = createTelegramProductionIntegration({
    secretToken: 'webhook-secret',
    botClient: { sendMessage: async () => ({ message_id: 1 }) },
    updateStore,
    identityResolver: async () => ({ identityContext: { globalUserId: 'user:1' } }),
    runtime: { async handle() { runtimeCalls += 1; return { message: 'unexpected' }; } },
    pollUpdates: {
      async handleUpdate(update, updateId) {
        pollCalls += 1;
        assert.equal(updateId, 500);
        assert.equal(update.poll.id, 'poll-tg-1');
        return { handled: true };
      }
    },
    acknowledgeBeforeProcessing: false
  });

  const first = await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'webhook-secret' },
    body: { update_id: 500, poll: { id: 'poll-tg-1', options: [], total_voter_count: 0 } }
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.pollUpdate, true);
  assert.equal(pollCalls, 1);
  assert.equal(runtimeCalls, 0);

  const duplicate = await integration.handleWebhook({
    headers: { 'x-telegram-bot-api-secret-token': 'webhook-secret' },
    body: { update_id: 500, poll: { id: 'poll-tg-1', options: [], total_voter_count: 0 } }
  });
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(pollCalls, 1);
});
