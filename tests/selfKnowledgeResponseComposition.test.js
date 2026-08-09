import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageAwareConversationResponder } from '../src/language/languageAwareConversationResponder.js';

test('response composer receives BoundedResponseContext through AI Router and cannot rely on raw identity guessing', async () => {
  let routed = null;
  const aiRouter = {
    async route(input) {
      routed = input;
      return { text: 'ok' };
    }
  };
  const responseContextAssembler = {
    async assemble({ request }) {
      return {
        version: '1.0',
        identity: { globalUserId: request.actor.globalUserId, roles: request.actor.roles },
        scope: request.scope,
        confirmedUserMemory: [{ key: 'display-name', value: 'Gary', confirmed: true }],
        confirmedProjectMemory: [],
        conversationContext: { recentTurns: [] },
        selfKnowledge: { snapshotVersion: 3, validationStatus: 'valid', facts: [{ category: 'identity', key: 'system-name', value: 'SG', status: 'implemented' }] },
        userSettings: null,
        languageContext: { responseLanguage: 'ru' },
        temporalContext: null,
        runtimeEvidence: null
      };
    }
  };
  const responder = createLanguageAwareConversationResponder({ aiRouter, responseContextAssembler });
  const request = {
    actor: { globalUserId: 'user:verified', roles: ['monarch'] },
    scope: { userScope: 'user:verified', projectScope: 'sg2.1', groupScope: null, threadScope: null },
    input: { languageContext: { responseLanguage: 'ru' }, semanticMessage: 'identify user' },
    traceContext: { traceId: 't', requestId: 'r' }
  };
  const result = await responder({ text: 'Кто я?', request });
  assert.equal(result, 'ok');
  assert.ok(routed);
  const payload = JSON.parse(routed.messages[1].content);
  assert.equal(payload.boundedResponseContext.identity.globalUserId, 'user:verified');
  assert.equal(payload.boundedResponseContext.confirmedUserMemory[0].value, 'Gary');
  assert.equal(payload.boundedResponseContext.selfKnowledge.facts[0].value, 'SG');
  assert.equal(routed.metadata.selfKnowledgeVersion, 3);
  assert.match(routed.messages[0].content, /do not assign or change identity/i);
  assert.match(routed.messages[0].content, /planned, disabled, broken and unknown/i);
});

test('response context is assembled even when AI is unavailable, preserving a single SG answer boundary', async () => {
  let calls = 0;
  const responder = createLanguageAwareConversationResponder({
    responseContextAssembler: { async assemble() { calls += 1; return { version: '1.0' }; } }
  });
  const response = await responder({
    text: 'hello',
    request: { actor: { globalUserId: 'u', roles: ['guest'] }, scope: { userScope: 'u', projectScope: 'sg2.1' }, input: { languageContext: { responseLanguage: 'en' } }, traceContext: { traceId: 't', requestId: 'r' } }
  });
  assert.equal(calls, 1);
  assert.match(response, /AI_NOT_INITIALIZED/);
});
