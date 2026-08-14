import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('ru');

for (const text of ['привет', 'кто ты?', 'кто я?']) {
  test(`conversational response never exact-echoes user input: ${text}`, async () => {
    const harness = createLocalProductionHarness();
    await harness.runtime.start();
    try {
      const result = await harness.transport.send({ text, userId: 'echo-regression-user', projectId: 'sg2.1' });
      assert.notEqual(normalize(result.response.message), normalize(text));
      assert.ok(String(result.response.message ?? '').trim().length > 0);
    } finally {
      await harness.runtime.stop();
    }
  });
}

test('unknown semantic capability cannot leak the original user text through Action Gate fallback', async () => {
  const interpretationResolver = () => ({
    meaning: 'Greeting',
    goal: 'greet-user',
    intent: 'answer',
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'greet', name: 'invented-greeting-capability', actionClass: 'analysis' }],
    rationale: 'Regression fixture for an invented semantic capability.'
  });
  const harness = createLocalProductionHarness({ interpretationResolver });
  await harness.runtime.start();
  try {
    const text = 'привет';
    const result = await harness.transport.send({ text, userId: 'echo-gate-regression-user', projectId: 'sg2.1' });
    assert.equal(result.response.data.gateOutcome, 'downgrade-to-prepare');
    assert.notEqual(normalize(result.response.message), normalize(text));
    assert.match(result.response.message, /could not produce a final conversational response/i);
    const started = harness.observability.list({ traceId: result.canonicalInput.traceContext.traceId, eventClass: 'capability_started' });
    assert.equal(started.length, 0);
  } finally {
    await harness.runtime.stop();
  }
});
