import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createActionRequest } from '../src/contracts/action.js';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';
import { createDeploymentSelfKnowledgeSources } from '../src/selfKnowledge/deploymentSelfKnowledge.js';
import { createPostgresPersistence } from '../src/persistence/index.js';
import { createProductionTelegramIdentityResolver } from '../src/identity/productionTelegramIdentityResolver.js';

function canonicalId() { return `usr_${randomUUID().replaceAll('-', '').slice(0, 16)}`; }

test('ActionRequest preserves descriptive profile without changing authority fields', () => {
  const request = createActionRequest({
    capability: 'compose-answer', actionType: 'answer', actionClass: 'analysis-only',
    actor: { globalUserId: 'usr_1111111111111111', roles: ['guest'], grants: ['capability:compose-answer'], authenticationLevel: 'verified', profile: { displayName: 'Игорь Корж', username: 'monarch', source: 'telegram' } },
    scope: { userScope: 'usr_1111111111111111', projectScope: 'sg2.1', allowedCapabilities: ['compose-answer'] },
    traceContext: { traceId: 'trace-profile', requestId: 'request-profile' }
  });
  assert.equal(request.actor.profile.displayName, 'Игорь Корж');
  assert.equal(request.actor.profile.username, 'monarch');
  assert.deepEqual(request.actor.roles, ['guest']);
});

test('SG response composer is explicitly bound to SG identity rather than base model identity', async () => {
  let routed = null;
  const responder = createLanguageAwareConversationResponder({
    aiRouter: { async route(input) { routed = input; return { text: 'Я — СГ (Советник GARYA).' }; } },
    responseContextAssembler: { async assemble() { return { version: '2.1', identity: { globalUserId: 'usr_1111111111111111', roles: ['monarch'], profile: { displayName: 'Игорь Корж' }, profileAuthority: 'descriptive-only' }, selfKnowledge: { snapshotVersion: 1, validationStatus: 'valid', facts: [{ category: 'identity', key: 'system-name', value: { short: 'SG', full: 'Советник GARYA' }, status: 'implemented' }] } }; } }
  });
  const response = await responder({ text: 'кто ты?', request: { actor: { globalUserId: 'usr_1111111111111111', roles: ['monarch'] }, input: { languageContext: { responseLanguage: 'ru' } }, traceContext: { traceId: 't', requestId: 'r' } } });
  assert.equal(response, 'Я — СГ (Советник GARYA).');
  const system = routed.messages.find((message) => message.role === 'system').content;
  assert.match(system, /SG \(Советник GARYA\)/);
  assert.match(system, /never present the underlying AI provider\/model\/text model as SG's identity/i);
  assert.match(system, /descriptive evidence only/i);
  const userPayload = JSON.parse(routed.messages.find((message) => message.role === 'user').content);
  assert.equal(userPayload.boundedResponseContext.identity.profile.displayName, 'Игорь Корж');
});

test('Deployment Self Knowledge reports Memory 2.0 as implemented and retains SG canonical identity', async () => {
  const [canonical, runtime] = createDeploymentSelfKnowledgeSources({ config: { revision: 'test-r', environment: 'test' }, capabilityNames: [] });
  const canonicalFacts = (await canonical.collect()).facts;
  const runtimeFacts = (await runtime.collect()).facts;
  const name = canonicalFacts.find((fact) => fact.key === 'system-name');
  const memory2 = runtimeFacts.find((fact) => fact.key === 'memory-2.0-program');
  assert.deepEqual(name.value, { short: 'SG', full: 'Советник GARYA' });
  assert.equal(name.status, 'implemented');
  assert.equal(memory2.status, 'implemented');
});

const connectionString = process.env.DATABASE_URL;
const integration = connectionString ? test : test.skip;

integration('Telegram display name and username are descriptive only; only canonical configured identity becomes Monarch', async () => {
  const persistence = createPostgresPersistence({ connectionString, ssl: false, applicationName: 'sg-identity-description-regression' });
  await persistence.start();
  const monarchGlobalUserId = canonicalId();
  const monarchTelegramUserId = `tg-${randomUUID()}`;
  const impostorTelegramUserId = `tg-${randomUUID()}`;
  const resolver = createProductionTelegramIdentityResolver({ persistence, projectScope: 'sg2.1', monarchTelegramUserId, monarchGlobalUserId });
  try {
    const profile = { displayName: 'Одинаковое Имя', firstName: 'Одинаковое', lastName: 'Имя', username: 'same_username', source: 'telegram' };
    const monarch = await resolver({ platformFacts: { platform: 'telegram', platformUserId: monarchTelegramUserId, profile }, scopeFacts: { projectId: 'sg2.1' } });
    const impostor = await resolver({ platformFacts: { platform: 'telegram', platformUserId: impostorTelegramUserId, profile }, scopeFacts: { projectId: 'sg2.1' } });

    assert.equal(monarch.identityContext.globalUserId, monarchGlobalUserId);
    assert.ok(monarch.identityContext.roles.includes('monarch'));
    assert.equal(monarch.identityContext.profile.displayName, 'Одинаковое Имя');

    assert.notEqual(impostor.identityContext.globalUserId, monarchGlobalUserId);
    assert.equal(impostor.identityContext.roles.includes('monarch'), false);
    assert.ok(impostor.identityContext.roles.includes('guest'));
    assert.equal(impostor.identityContext.profile.username, 'same_username');

    const persisted = await persistence.repositories.users.get(monarchGlobalUserId);
    assert.equal(persisted.profile.displayName, 'Одинаковое Имя');
  } finally {
    await persistence.database.query('DELETE FROM users WHERE global_user_id=$1 OR global_user_id=$2', [monarchGlobalUserId, (await persistence.repositories.identities.resolve('telegram', impostorTelegramUserId))?.global_user_id ?? 'none']);
    await persistence.close();
  }
});
