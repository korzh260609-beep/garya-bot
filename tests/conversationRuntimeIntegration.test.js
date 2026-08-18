import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

function interpretation(input, captures) {
  captures.push({
    text: input.text,
    conversationContext: input.metadata?.conversationContext ?? null,
    contextBundle: input.metadata?.contextBundle ?? null
  });
  return {
    meaning: `answer ${input.text}`,
    goal: 'respond',
    intent: 'answer',
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'conversation runtime integration fixture'
  };
}

test('Block 16.11 runtime resolves bounded conversation context before semantic interpretation', async () => {
  const captures = [];
  const harness = createLocalProductionHarness({ interpretationResolver: (input) => interpretation(input, captures) });
  await harness.runtime.start();
  try {
    const first = await harness.transport.send({ userId: 'u1', sessionId: 'session-a', messageId: 'm1', text: 'first turn' });
    const second = await harness.transport.send({ userId: 'u1', sessionId: 'session-a', messageId: 'm2', text: 'second turn' });
    const firstContext = first.response.data.conversationContext;
    const secondContext = second.response.data.conversationContext;
    assert.ok(firstContext.conversationId);
    assert.equal(secondContext.conversationId, firstContext.conversationId);
    assert.equal(secondContext.sessionId, firstContext.sessionId);
    assert.ok(captures[0].conversationContext);
    const latest = captures.at(-1).conversationContext;
    assert.equal(latest.conversationId, firstContext.conversationId);
    assert.ok(latest.recentTurns.some((turn) => turn.text === 'first turn'));
    assert.ok(latest.recentTurns.some((turn) => turn.text === 'second turn'));
    assert.equal(captures.at(-1).contextBundle, null);
  } finally {
    await harness.runtime.stop();
  }
});


test('production response context restores durable conversation history through the wired service', async () => {
  const harness = createLocalProductionHarness({ interpretationResolver: (input) => interpretation(input, []) });
  await harness.runtime.start();
  try {
    const first = await harness.transport.send({ userId: 'history-user', sessionId: 'history-session', messageId: 'history-m1', text: 'Моя контрольная фраза — синий маяк.' });
    const conversationContext = first.response.data.conversationContext;
    const assembled = await harness.responseContextAssembler.assemble({
      request: {
        actor: first.canonicalInput.identityContext,
        scope: first.canonicalInput.scopeContext,
        input: {
          text: 'Что я говорил раньше?',
          semanticMessage: 'Recall the user previous statement',
          memoryQuery: 'previous user statement',
          conversationContext,
          conversationHistoryQuery: {
            query: 'контрольная фраза',
            temporalExpression: null,
            scope: 'current-conversation',
            maxRecords: 100
          }
        },
        traceContext: {
          traceId: 'trace-conversation-history-wiring',
          requestId: 'request-conversation-history-wiring',
          environment: 'test',
          revision: 'test'
        }
      },
      semanticMessage: 'Recall the user previous statement'
    });

    assert.ok(assembled.conversationHistory);
    assert.equal(assembled.conversationHistory.scope, 'current-conversation');
    assert.ok(assembled.conversationHistory.turns.some((turn) => turn.text === 'Моя контрольная фраза — синий маяк.'));
  } finally {
    await harness.runtime.stop();
  }
});
