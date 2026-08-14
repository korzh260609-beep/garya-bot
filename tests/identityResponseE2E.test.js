import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

const SELF_CASES = Object.freeze([
  'кто ты?',
  'что такое СГ?',
  'расскажи о себе',
  'who are you?'
]);

const USER_CASES = Object.freeze([
  'кто я?',
  'какая у меня роль?',
  'что ты обо мне знаешь?'
]);

const INTENTS = new Map([
  ...SELF_CASES.map((text) => [text, 'self_identity']),
  ...USER_CASES.map((text) => [text, 'user_identity'])
]);

function identityInterpretation(input) {
  const intent = INTENTS.get(input.text);
  if (!intent) throw new Error(`Unexpected identity E2E input: ${input.text}`);
  return {
    meaning: intent === 'self_identity'
      ? 'The current user asks SG to identify or describe itself.'
      : 'The current user asks for verified information about their own identity.',
    goal: intent === 'self_identity' ? 'describe-sg-identity' : 'describe-current-user-identity',
    intent,
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'E2E fixture supplies semantic intent; production behavior must not depend on literal wording.'
  };
}

async function withHarness(run) {
  const harness = createLocalProductionHarness({ interpretationResolver: identityInterpretation });
  await harness.runtime.start();
  try {
    await run(harness);
  } finally {
    await harness.runtime.stop();
  }
}

for (const text of SELF_CASES) {
  test(`identity E2E self_identity: ${text}`, async () => {
    await withHarness(async (harness) => {
      const result = await harness.transport.send({ text, userId: 'gary', projectId: 'sg2.1' });
      assert.equal(result.response.status, 'success');
      assert.equal(result.response.data.decisionEnvelope.intent, 'self_identity');
      assert.equal(result.response.data.decisionEnvelope.selectedAction.payload.semanticIntent, 'self_identity');
      assert.match(result.response.message, /Советник GARYA/u);
      assert.notEqual(result.response.message.trim().toLocaleLowerCase(), text.trim().toLocaleLowerCase());
    });
  });
}

for (const text of USER_CASES) {
  test(`identity E2E user_identity: ${text}`, async () => {
    await withHarness(async (harness) => {
      const result = await harness.transport.send({ text, userId: 'gary', projectId: 'sg2.1' });
      const globalUserId = result.canonicalInput.identityContext.globalUserId;
      assert.equal(result.response.status, 'success');
      assert.equal(result.response.data.decisionEnvelope.intent, 'user_identity');
      assert.equal(result.response.data.decisionEnvelope.selectedAction.payload.semanticIntent, 'user_identity');
      assert.ok(result.response.message.includes(globalUserId));
      assert.match(result.response.message, /monarch/u);
      assert.notEqual(result.response.message.trim().toLocaleLowerCase(), text.trim().toLocaleLowerCase());
    });
  });
}
