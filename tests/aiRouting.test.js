import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { createInMemoryAITelemetry } from '../src/ai/telemetry.js';
import { createProductionMeaningInterpreter } from '../src/ai/productionMeaningInterpreter.js';
import { createSemanticKernel } from '../src/semantic/semanticKernel.js';
import { AIOutputValidationError, AIProviderError } from '../src/ai/errors.js';

const traceContext = { traceId: 'trace-1', requestId: 'request-1' };
const registry = () => createModelRegistry([
  {
    id: 'primary',
    provider: 'fake',
    model: 'reasoner',
    specialties: ['reasoning', 'semantic-interpretation'],
    fallbackId: 'fallback'
  },
  {
    id: 'fallback',
    provider: 'fake-fallback',
    model: 'backup',
    specialties: ['reasoning-fallback']
  }
]);

test('router normalizes provider result and records telemetry without prompt content', async () => {
  const telemetry = createInMemoryAITelemetry();
  const router = createAIRouter({
    registry: registry(),
    providers: {
      fake: {
        async generate() {
          return { text: '{}', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } };
        }
      },
      'fake-fallback': { async generate() { throw new Error('unused'); } }
    },
    telemetry
  });

  const result = await router.route({
    task: 'test',
    reason: 'contract test',
    specialty: 'reasoning',
    messages: [{ role: 'user', content: 'secret prompt' }],
    traceContext
  });

  assert.equal(result.provider, 'fake');
  assert.equal(result.attempts, 1);
  assert.equal(result.traceId, 'trace-1');
  assert.equal(telemetry.list().some((event) => JSON.stringify(event).includes('secret prompt')), false);
});

test('router retries retryable failure and then succeeds', async () => {
  let attempts = 0;
  const router = createAIRouter({
    registry: registry(),
    providers: {
      fake: {
        async generate() {
          attempts += 1;
          if (attempts === 1) throw new AIProviderError('temporary', { retryable: true });
          return { text: '{}' };
        }
      },
      'fake-fallback': { async generate() { throw new Error('unused'); } }
    },
    maxRetries: 1,
    retryDelayMs: 0
  });

  const result = await router.route({
    task: 'test',
    reason: 'retry test',
    messages: [{ role: 'user', content: 'x' }],
    traceContext
  });

  assert.equal(result.attempts, 2);
});

test('router uses bounded fallback after primary failure', async () => {
  const router = createAIRouter({
    registry: registry(),
    providers: {
      fake: { async generate() { throw new AIProviderError('down', { retryable: false }); } },
      'fake-fallback': { async generate() { return { text: '{}' }; } }
    },
    maxRetries: 0
  });

  const result = await router.route({
    task: 'test',
    reason: 'fallback test',
    messages: [{ role: 'user', content: 'x' }],
    traceContext
  });

  assert.equal(result.model, 'backup');
  assert.equal(result.fallbackUsed, true);
});

test('production interpreter fails closed on invalid JSON', async () => {
  const interpreter = createProductionMeaningInterpreter({
    aiRouter: { async route() { return { text: 'not-json' }; } }
  });

  await assert.rejects(
    () => interpreter.interpret({ text: 'x', locale: 'en', scopeContext: {}, traceContext, metadata: {} }),
    AIOutputValidationError
  );
});

test('production interpreter integrates with Semantic Kernel', async () => {
  const payload = {
    meaning: 'Continue SG development',
    goal: 'continue-development',
    intent: 'answer',
    entities: [],
    constraints: [],
    uncertainty: 0,
    missingInformation: [],
    clarificationQuestion: null,
    contextNeeds: [],
    evidenceNeeds: [],
    candidateActions: [{ type: 'answer', name: 'compose-answer', actionClass: 'analysis' }],
    rationale: 'clear request'
  };
  const interpreter = createProductionMeaningInterpreter({
    aiRouter: {
      async route(input) {
        assert.equal(input.specialty, 'semantic-interpretation');
        return { text: JSON.stringify(payload) };
      }
    }
  });
  const kernel = createSemanticKernel({ meaningInterpreter: interpreter });
  const result = await kernel.process({
    text: 'Continue SG',
    locale: 'en',
    identityContext: { globalUserId: 'u' },
    scopeContext: { userScope: 'u' },
    traceContext,
    metadata: {}
  });

  assert.equal(result.decisionEnvelope.decisionType, 'answer');
  assert.equal(result.interpretation.goal, 'continue-development');
});
