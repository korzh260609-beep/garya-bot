import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createActionRequest } from '../src/contracts/action.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';
import { createProductionTelegramIdentityResolver } from '../src/runtime/renderWebApplication.js';
import { createOwnerSecurityConfig, createOwnerSecurityGateway } from '../src/security/ownerSecurity.js';
import { createProductionWorkerActionGate } from '../src/automation/productionWorkerExecution.js';

const OWNER = 'usr_aaaaaaaaaaaaaaaa';
const OTHER = 'usr_bbbbbbbbbbbbbbbb';
const connectionString = process.env.DATABASE_URL;
const postgresIntegration = connectionString ? test : test.skip;

function answerInterpretation(input) {
  return {
    meaning: `E2E: ${input.text}`,
    goal: 'respond',
    intent: 'answer',
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'Block 18 deterministic E2E fixture.'
  };
}

function actor(globalUserId, roles = ['monarch']) {
  return { globalUserId, roles, grants: ['memory:confirm'], authenticationLevel: 'verified' };
}

function scope(globalUserId, projectScope = 'sg2.1', groupScope = null, threadScope = null) {
  return { userScope: globalUserId, projectScope, groupScope, threadScope };
}

function fakeIdentityPersistence() {
  const links = new Map();
  const roles = new Map();
  const grants = new Map();
  const key = (user, project) => `${user}:${project}`;
  return {
    repositories: {
      identities: {
        async resolve(platform, platformUserId) { return links.get(`${platform}:${platformUserId}`) ?? null; },
        async link({ platform, platformUserId, globalUserId }) {
          const row = { platform, platform_user_id: platformUserId, global_user_id: globalUserId };
          links.set(`${platform}:${platformUserId}`, row);
          return row;
        }
      },
      access: {
        async grantRole({ globalUserId, projectScope, role }) {
          const k = key(globalUserId, projectScope);
          roles.set(k, [...new Set([...(roles.get(k) ?? []), role])]);
        },
        async grantPermission({ globalUserId, projectScope, grantName }) {
          const k = key(globalUserId, projectScope);
          grants.set(k, [...new Set([...(grants.get(k) ?? []), grantName])]);
        },
        async list({ globalUserId, projectScope }) {
          const k = key(globalUserId, projectScope);
          return { roles: roles.get(k) ?? [], grants: (grants.get(k) ?? []).map((grant_name) => ({ grant_name, constraints: {} })) };
        }
      }
    }
  };
}

function ownerSensitiveRequest(globalUserId = OTHER, roles = []) {
  return createActionRequest({
    capability: 'security-policy-update',
    actionType: 'update',
    actionClass: 'state-changing',
    actor: { globalUserId, roles, grants: ['capability:security-policy-update'], authenticationLevel: 'verified' },
    scope: { userScope: globalUserId, projectScope: 'sg2.1', groupScope: null, threadScope: null, allowedCapabilities: ['security-policy-update'] },
    payload: { ownerOnly: true },
    requiredPermission: 'capability:security-policy-update',
    confirmation: { confirmed: true, requestId: 'e2e-owner-request' },
    traceContext: { traceId: 'e2e-owner-trace', requestId: 'e2e-owner-request', environment: 'test', revision: 'block-18' }
  });
}

test('Block 18: full runtime path keeps identity, group/thread, language, delivery and observability isolated', async () => {
  const harness = createLocalProductionHarness({ interpretationResolver: answerInterpretation });
  await harness.runtime.start();
  try {
    const privateResult = await harness.transport.send({
      text: 'Привіт, поясни статус системи', locale: 'uk-UA', userId: 'user-a', projectId: 'sg2.1'
    });
    const groupResult = await harness.transport.send({
      text: 'Проверь deployment status проекта', locale: 'ru-RU', userId: 'user-b', projectId: 'sg2.1', groupId: 'group-1', threadId: 'thread-7'
    });

    assert.equal(privateResult.response.status, 'success');
    assert.equal(groupResult.response.status, 'success');
    assert.notEqual(privateResult.canonicalInput.identityContext.globalUserId, groupResult.canonicalInput.identityContext.globalUserId);
    assert.equal(privateResult.canonicalInput.scopeContext.groupScope, null);
    assert.equal(groupResult.canonicalInput.scopeContext.groupScope, 'group-1');
    assert.equal(groupResult.canonicalInput.scopeContext.threadScope, 'thread-7');
    assert.equal(privateResult.response.data.languageContext.responseLanguage, 'uk');
    assert.equal(groupResult.response.data.languageContext.responseLanguage, 'ru');
    assert.equal(harness.transport.deliveries.length, 2);

    for (const result of [privateResult, groupResult]) {
      const traceId = result.canonicalInput.traceContext.traceId;
      assert.ok(harness.observability.list({ channel: 'telemetry', traceId, eventClass: 'semantic_decision_created' }).length >= 1);
      assert.ok(harness.observability.list({ channel: 'telemetry', traceId, eventClass: 'capability_completed' }).length >= 1);
      assert.ok(harness.observability.list({ channel: 'audit', traceId, eventClass: 'action_gate_decision' }).length >= 1);
      const conversation = harness.observability.list({ channel: 'telemetry', traceId }).find((event) => event.data?.contextEventClass === 'conversation_context_resolved');
      assert.ok(conversation?.data?.conversationId);
    }
  } finally {
    await harness.runtime.stop();
  }
});

test('Block 18: simultaneous conversations and approved cross-transport continuation do not contaminate context', async () => {
  const harness = createLocalProductionHarness();
  const service = harness.conversationContextService;
  const base = { globalUserId: 'usr_e2e_context', projectScope: 'sg2.1', text: 'hello' };

  const a = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'A', platformMessageId: 'a1', text: 'alpha' });
  const b = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'B', platformMessageId: 'b1', text: 'beta' });
  const a2 = await service.resolveTurn({ ...base, transport: 'web-api', transportSessionId: 'A', platformMessageId: 'a2', text: 'alpha-2' });
  assert.notEqual(a.conversationId, b.conversationId);
  assert.equal(a2.conversationId, a.conversationId);
  assert.equal(a2.recentTurns.some((turn) => turn.text === 'beta'), false);

  await assert.rejects(
    () => service.resolveTurn({ ...base, transport: 'telegram', transportSessionId: 'tg', continueConversationId: a.conversationId, platformMessageId: 'tg1' }),
    (error) => error.code === 'conversation-cross-scope-denied'
  );
  await service.approveCrossTransportContinuation({ conversationId: a.conversationId, globalUserId: base.globalUserId, projectScope: base.projectScope });
  const continued = await service.resolveTurn({ ...base, transport: 'telegram', transportSessionId: 'tg', continueConversationId: a.conversationId, platformMessageId: 'tg2' });
  assert.equal(continued.conversationId, a.conversationId);
  assert.equal(continued.transition, 'approved-cross-transport');
});

test('Block 18: linked global identity retains approved memory/settings while another user stays isolated', async () => {
  const harness = createLocalProductionHarness();
  const globalUserId = 'usr_e2e_global';
  const otherUserId = 'usr_e2e_other';
  await harness.languageContextService.setPreferred(globalUserId, 'uk', { locale: 'uk-UA' });
  await harness.memory2Service.write({
    key: 'e2e-preference', value: 'short', scope: scope(globalUserId), actor: actor(globalUserId), confirmed: true
  });

  const linkedActor = { ...actor(globalUserId), platform: 'web-api', platformUserId: 'web-1' };
  const linkedRecall = await harness.memory2Service.recall({ scope: scope(globalUserId), actor: linkedActor, query: 'e2e preference' });
  const isolatedRecall = await harness.memory2Service.recall({ scope: scope(otherUserId), actor: actor(otherUserId), query: 'e2e preference' });
  const linkedLanguage = await harness.languageContextService.resolve({ globalUserId, text: 'OK' });
  const isolatedLanguage = await harness.languageContextService.resolve({ globalUserId: otherUserId, text: 'OK' });

  assert.equal(linkedRecall.records[0].value, 'short');
  assert.equal(isolatedRecall.records.length, 0);
  assert.equal(linkedLanguage.responseLanguage, 'uk');
  assert.notEqual(isolatedLanguage.responseLanguage, 'uk');
});

test('Block 18: production Telegram identity rejects impersonation and keeps guest identity stable', async () => {
  const persistence = fakeIdentityPersistence();
  const resolver = createProductionTelegramIdentityResolver({
    persistence,
    projectScope: 'sg2.1',
    monarchTelegramUserId: '100',
    monarchGlobalUserId: OWNER
  });
  const monarch = await resolver({ platformFacts: { platform: 'telegram', platformUserId: '100' }, scopeFacts: { projectId: 'sg2.1' } });
  const guest = await resolver({ platformFacts: { platform: 'telegram', platformUserId: '200' }, scopeFacts: { projectId: 'sg2.1' } });
  const sameGuest = await resolver({ platformFacts: { platform: 'telegram', platformUserId: '200' }, scopeFacts: { projectId: 'sg2.1' } });

  assert.equal(monarch.identityContext.globalUserId, OWNER);
  assert.equal(monarch.identityContext.roles.includes('monarch'), true);
  assert.equal(guest.identityContext.roles.includes('monarch'), false);
  assert.notEqual(guest.identityContext.globalUserId, OWNER);
  assert.equal(sameGuest.identityContext.globalUserId, guest.identityContext.globalUserId);
});

test('Block 18: owner-only operations fail closed and deferred worker execution preserves original actor', async () => {
  const gateway = createOwnerSecurityGateway({ config: createOwnerSecurityConfig({ MONARCH_GLOBAL_USER_ID: OWNER }) });
  const direct = gateway.evaluate(ownerSensitiveRequest(OTHER, ['monarch']));
  assert.equal(direct.allowed, false);
  assert.equal(direct.reason, 'owner-identity-mismatch');

  const workerGate = createProductionWorkerActionGate({ ownerSecurityGateway: gateway });
  const deferred = await workerGate({
    taskId: 'e2e-task-owner', kind: 'system-change', actorGlobalUserId: OTHER, projectScope: 'sg2.1',
    identityContext: { globalUserId: OWNER, roles: ['monarch'], grants: ['*'] },
    payload: { ownerOnly: true, capability: 'security-policy-update' },
    traceContext: { traceId: 'e2e-worker-trace', requestId: 'e2e-worker-request', environment: 'test', revision: 'block-18' }
  });
  assert.equal(deferred.allowed, false);
  assert.equal(deferred.reason, 'owner-identity-mismatch');
});

test('Block 18: feature cohorts and kill switch are enforced without granting missing authorization', async () => {
  const harness = createLocalProductionHarness();
  const context = {
    environment: harness.config.environment,
    projectScope: 'sg2.1',
    globalUserId: 'usr_e2e_feature',
    roles: ['monarch'],
    cohorts: ['block18'],
    permissionSatisfied: true,
    authoritySatisfied: true,
    actionGateSatisfied: true
  };
  await harness.featureFlags.setFlag({ featureId: 'block18:pilot', enabled: true, projects: ['sg2.1'], roles: ['monarch'], cohorts: ['block18'] });
  assert.equal((await harness.featureFlags.resolve('block18:pilot', context)).enabled, true);
  assert.equal((await harness.featureFlags.resolve('block18:pilot', { ...context, permissionSatisfied: false })).enabled, false);
  await harness.featureFlags.setFlag({ featureId: 'block18:pilot', enabled: true, killSwitch: true, projects: ['sg2.1'] });
  const killed = await harness.featureFlags.resolve('block18:pilot', context);
  assert.equal(killed.enabled, false);
  assert.equal(killed.source, 'kill-switch');
});

test('Block 18: runtime startup builds valid bounded Self Knowledge and live diagnostics evidence', async () => {
  const harness = createLocalProductionHarness({ env: { SG_REVISION: 'block-18-e2e' } });
  await harness.runtime.start();
  try {
    const snapshot = await harness.selfKnowledgeService.getSnapshot({ environment: harness.config.environment });
    assert.ok(snapshot);
    assert.equal(snapshot.sourceRevision, 'block-18-e2e');
    assert.equal(snapshot.validationStatus, 'valid');
    const query = await harness.selfKnowledgeService.query({ environment: harness.config.environment, maxFacts: 12 });
    assert.ok(query.facts.length > 0);
    assert.ok(query.facts.length <= 12);
    assert.equal(harness.runtime.readiness().ready, true);
  } finally {
    await harness.runtime.stop();
  }
});

postgresIntegration('Block 18: PostgreSQL restart preserves memory and conversation continuity', async () => {
  const id = randomUUID();
  const globalUserId = `usr_e2e_${id.replaceAll('-', '').slice(0, 16)}`;
  const transportSessionId = `e2e-session-${id}`;
  const env = {
    SG_PERSISTENCE_MODE: 'postgres', DATABASE_URL: connectionString, DATABASE_SSL: 'false', SG_REVISION: `block-18-${id}`
  };

  const first = createLocalProductionHarness({ env });
  await first.runtime.start();
  let conversation;
  try {
    await first.memory2Service.write({ key: `restart-${id}`, value: 'survives', scope: scope(globalUserId), actor: actor(globalUserId), confirmed: true });
    conversation = await first.conversationContextService.resolveTurn({
      globalUserId, projectScope: 'sg2.1', transport: 'web-api', transportSessionId, platformMessageId: `${id}-1`, text: 'before restart'
    });
  } finally {
    await first.runtime.stop();
  }

  const second = createLocalProductionHarness({ env });
  await second.runtime.start();
  try {
    const recall = await second.memory2Service.recall({ scope: scope(globalUserId), actor: actor(globalUserId), query: `restart ${id}` });
    assert.equal(recall.records.some((record) => record.value === 'survives'), true);
    const continued = await second.conversationContextService.resolveTurn({
      globalUserId, projectScope: 'sg2.1', transport: 'web-api', transportSessionId, platformMessageId: `${id}-2`, text: 'after restart'
    });
    assert.equal(continued.conversationId, conversation.conversationId);
    assert.equal(continued.transition, 'continuation');
  } finally {
    await second.runtime.stop();
  }
});
