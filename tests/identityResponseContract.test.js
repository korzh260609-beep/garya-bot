import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessIdentityResponseContract,
  createIdentityResponseContract,
  renderIdentityResponseFallback
} from '../src/identity/identityResponseContract.js';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';

function selfContext() {
  return {
    version: '2.1',
    identity: { globalUserId: 'usr_test', roles: ['monarch'], profile: null },
    confirmedUserMemory: [],
    selfKnowledge: {
      validationStatus: 'valid',
      facts: [
        { category: 'identity', key: 'system-name', value: { short: 'SG', full: 'Советник GARYA' }, status: 'implemented', confidence: 1, provenance: { sourceType: 'authority', sourceId: 'pillars/SG_ENTITY.md', sourceRevision: 'r1' } },
        { category: 'identity', key: 'entity-type', value: 'one global transport-independent project system', status: 'implemented', confidence: 1, provenance: { sourceType: 'authority', sourceId: 'pillars/SG_ENTITY.md', sourceRevision: 'r1' } },
        { category: 'purpose', key: 'core-purpose', value: 'Coordinate verified context and controlled reasoning.', status: 'implemented', confidence: 1, provenance: { sourceType: 'authority', sourceId: 'pillars/SG_ENTITY.md', sourceRevision: 'r1' } }
      ]
    }
  };
}

function userContext() {
  return {
    version: '2.1',
    identity: {
      globalUserId: 'usr_0123456789abcdef',
      roles: ['monarch'],
      profile: { preferredName: 'GARY', displayName: 'Корж Игорь', username: 'gary_example', source: 'telegram' },
      profileAuthority: 'descriptive-only',
      authenticationLevel: 'telegram-webhook'
    },
    confirmedUserMemory: [
      { key: 'project-role', value: 'owner of SG', trust: 'confirmed', confirmed: true, privacyClass: 'private', scopeKind: 'user', provenance: { sourceType: 'user', sourceId: 'm1' } },
      { key: 'unconfirmed', value: 'must not pass', trust: 'reported', confirmed: false, provenance: { sourceType: 'dialogue', sourceId: 'm2' } }
    ],
    selfKnowledge: { validationStatus: 'valid', facts: [] }
  };
}

function request({ semanticIntent, context, responseLanguage = 'ru' }) {
  return {
    input: { semanticIntent, languageContext: { responseLanguage } },
    actor: { globalUserId: context.identity.globalUserId, roles: context.identity.roles },
    scope: { userScope: context.identity.globalUserId, projectScope: 'sg2.1' },
    traceContext: { traceId: 'trace-identity-contract', requestId: 'request-identity-contract' }
  };
}

test('self_identity contract requires canonical Советник GARYA authority fact', () => {
  const contract = createIdentityResponseContract({ semanticIntent: 'self_identity', boundedResponseContext: selfContext() });
  assert.equal(contract.active, true);
  assert.equal(contract.available, true);
  assert.equal(contract.payload.canonicalIdentity.fullName, 'Советник GARYA');
  assert.deepEqual(contract.requiredAnchors, ['Советник GARYA']);
  assert.equal(assessIdentityResponseContract({ contract, candidateText: 'Я — Советник GARYA.' }).ok, true);
  assert.equal(assessIdentityResponseContract({ contract, candidateText: 'Я обычный помощник.' }).ok, false);
});

test('user_identity contract uses verified identity, roles, profile and only confirmed user memory', () => {
  const contract = createIdentityResponseContract({ semanticIntent: 'user_identity', boundedResponseContext: userContext() });
  assert.equal(contract.active, true);
  assert.equal(contract.available, true);
  assert.equal(contract.payload.verifiedGlobalUserId, 'usr_0123456789abcdef');
  assert.deepEqual(contract.payload.roles, ['monarch']);
  assert.equal(contract.payload.canonicalProfile.preferredName, 'GARY');
  assert.deepEqual(contract.payload.permittedConfirmedMemory.map((item) => item.key), ['project-role']);
  assert.equal(JSON.stringify(contract).includes('must not pass'), false);
});

test('identity responder replaces AI answer that omits mandatory self identity', async () => {
  const context = selfContext();
  const responder = createLanguageAwareConversationResponder({
    aiRouter: { async route() { return { text: 'Я универсальный помощник.' }; } },
    responseContextAssembler: { async assemble() { return context; } }
  });
  const output = await responder({ text: 'кто ты?', request: request({ semanticIntent: 'self_identity', context }) });
  assert.match(output, /Советник GARYA/u);
  assert.doesNotMatch(output, /^Я универсальный помощник\.$/u);
});

test('identity responder replaces AI answer that omits verified Global ID or role', async () => {
  const context = userContext();
  const responder = createLanguageAwareConversationResponder({
    aiRouter: { async route() { return { text: 'Вы GARY.' }; } },
    responseContextAssembler: { async assemble() { return context; } }
  });
  const output = await responder({ text: 'кто я?', request: request({ semanticIntent: 'user_identity', context }) });
  assert.ok(output.includes('usr_0123456789abcdef'));
  assert.match(output, /monarch/u);
  assert.match(output, /GARY/u);
  assert.match(output, /project-role/u);
});

test('non-identity semantic intents do not activate identity contract', () => {
  const contract = createIdentityResponseContract({ semanticIntent: 'greeting', boundedResponseContext: selfContext() });
  assert.equal(contract.active, false);
  assert.equal(contract.available, false);
});

test('deterministic identity fallback stays grounded when AI is unavailable', () => {
  const contract = createIdentityResponseContract({ semanticIntent: 'self_identity', boundedResponseContext: selfContext() });
  assert.match(renderIdentityResponseFallback({ contract, responseLanguage: 'en' }), /Советник GARYA/u);
});
