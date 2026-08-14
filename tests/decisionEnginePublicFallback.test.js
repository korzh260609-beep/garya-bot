import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecisionEngine } from '../src/decision/decisionEngine.js';

test('answer response plan contains a safe localized fallback, never the internal placeholder', () => {
  const engine = createDecisionEngine();
  const result = engine.decide({
    canonicalInput: {
      text: 'я тебе говорил какая у меня машина?',
      locale: 'ru',
      traceContext: { traceId: 'trace-public-fallback', requestId: 'request-public-fallback' }
    },
    interpretation: {
      meaning: 'The user asks whether SG remembers a personal vehicle fact.',
      goal: 'answer from available context',
      intent: 'personal_memory_recall',
      entities: [],
      constraints: [],
      uncertainty: 0.1,
      missingInformation: [],
      clarificationQuestion: null,
      contextNeeds: ['user-memory'],
      evidenceNeeds: [],
      candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
      rationale: null
    }
  });

  assert.equal(result.responsePlan.mode, 'answer');
  assert.match(result.responsePlan.message, /^СГ не смог сформировать разговорный ответ/u);
  assert.equal(result.responsePlan.message.includes('SG could not produce a final conversational response.'), false);
  assert.equal(result.decisionEnvelope.selectedAction.name, 'compose-answer');
});
