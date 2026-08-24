import assert from 'node:assert/strict';
import test from 'node:test';

import { createProductionMeaningInterpreter } from '../src/ai/productionMeaningInterpreter.js';
import { createIdentityResponseContract } from '../src/identity/identityResponseContract.js';

const traceContext = Object.freeze({
  traceId: 'trace-semantic-identity-capability-boundary',
  requestId: 'request-semantic-identity-capability-boundary'
});

function canonicalInput(text) {
  return {
    text,
    locale: 'ru',
    identityContext: { roles: ['monarch'] },
    scopeContext: { projectScope: 'sg2.1' },
    traceContext,
    metadata: {}
  };
}

async function captureSemanticSystemInstruction(text) {
  let routed = null;
  const interpreter = createProductionMeaningInterpreter({
    fallbackOnFailure: true,
    aiRouter: {
      async route(input) {
        routed = input;
        throw Object.assign(new Error('intentional regression-test provider stop'), { code: 'TEST_STOP' });
      }
    }
  });

  await interpreter.interpret(canonicalInput(text));
  assert.ok(routed);
  return routed.messages[0].content;
}

test('semantic policy reserves self_identity for ontological system identity', async () => {
  const instruction = await captureSemanticSystemInstruction('кто ты?');

  assert.match(instruction, /self_identity is strictly the ontological identity of SG as an entity/u);
  assert.match(instruction, /who\/what SG is/u);
  assert.match(instruction, /what the system is called/u);
  assert.match(instruction, /definition or identification of the system itself/u);
});

test('semantic policy excludes SG capabilities traits behavior and limitations from self_identity', async () => {
  const instruction = await captureSemanticSystemInstruction('что ты можешь?');

  for (const semanticClass of ['capabilities', 'skills', 'traits', 'behavior', 'limitations']) {
    assert.ok(instruction.includes(semanticClass), `semantic policy must cover ${semanticClass}`);
  }
  assert.match(instruction, /Do NOT use self_identity for predicates about SG/u);
  assert.match(instruction, /ordinary semantic conversation\/capability-self-knowledge requests/u);
  assert.match(instruction, /candidate action type answer, name compose-answer, actionClass analysis/u);
});

test('representative capability and trait requests remain outside the identity response contract', () => {
  const representativeRequests = [
    'у тебя есть юмор?',
    'умеешь шутить?',
    'можешь анализировать фото?',
    'умеешь программировать?',
    'что ты можешь?'
  ];

  for (const text of representativeRequests) {
    const contract = createIdentityResponseContract({
      semanticIntent: 'answer',
      boundedResponseContext: {
        selfKnowledge: { validationStatus: 'valid', facts: [] }
      }
    });

    assert.equal(contract.active, false, `${text} must not activate IdentityResponseContract`);
    assert.equal(contract.reason, 'not-identity-intent');
  }
});

test('canonical self identity requests still activate the identity response contract', () => {
  const contract = createIdentityResponseContract({
    semanticIntent: 'self_identity',
    boundedResponseContext: {
      selfKnowledge: {
        validationStatus: 'valid',
        facts: [
          {
            category: 'identity',
            key: 'system-name',
            value: { short: 'SG', full: 'Советник GARYA' },
            status: 'implemented',
            confidence: 1,
            provenance: {
              sourceType: 'authority',
              sourceId: 'pillars/SG_ENTITY.md',
              sourceRevision: 'test'
            }
          }
        ]
      }
    }
  });

  assert.equal(contract.active, true);
  assert.equal(contract.available, true);
  assert.equal(contract.intent, 'self_identity');
});
