import test from 'node:test';
import assert from 'node:assert/strict';

import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { createProductionAiPolicy } from '../src/ai/productionPolicy.js';
import { createOpenAIResponsesProvider } from '../src/ai/providers/openaiResponsesProvider.js';
import { AIProviderError } from '../src/ai/errors.js';

const traceContext = Object.freeze({ traceId: 'trace-ai-budget', requestId: 'request-ai-budget' });

function registry() {
  return createModelRegistry([{
    id: 'reasoning-primary',
    provider: 'fake',
    model: 'reasoner',
    specialties: ['reasoning', 'semantic-interpretation'],
    inputCostPerMillion: 0,
    outputCostPerMillion: 0,
  }]);
}

function policy(extra = {}) {
  return createProductionAiPolicy({
    SG_AI_ENABLED: 'true',
    SG_AI_MAX_OUTPUT_TOKENS: '2000',
    SG_AI_LANGUAGE_MAX_OUTPUT_TOKENS: '512',
    SG_AI_SEMANTIC_MAX_OUTPUT_TOKENS: '3000',
    SG_AI_RESPONSE_MAX_OUTPUT_TOKENS: '8000',
    SG_AI_GUEST_MAX_COST_USD: '1',
    ...extra,
  });
}

test('response composition receives a dedicated output budget instead of the global semantic-sized default', async () => {
  let capturedRequest = null;
  const router = createAIRouter({
    registry: registry(),
    providers: {
      fake: {
        async generate({ request }) {
          capturedRequest = request;
          return { text: 'ok', usage: {} };
        }
      }
    },
    policy: policy(),
    maxRetries: 0,
  });

  await router.route({
    task: 'response-composition',
    specialty: 'reasoning',
    reason: 'compose a conversational answer',
    role: 'guest',
    messages: [{ role: 'user', content: 'write a story' }],
    traceContext,
  });

  assert.equal(capturedRequest.maxOutputTokens, 8000);
});

test('max_output_tokens incomplete response retries once with a larger budget', async () => {
  const seenBudgets = [];
  let calls = 0;
  const router = createAIRouter({
    registry: registry(),
    providers: {
      fake: {
        async generate({ request }) {
          calls += 1;
          seenBudgets.push(request.maxOutputTokens);
          if (calls === 1) {
            throw new AIProviderError('OpenAI response was incomplete: max_output_tokens', {
              code: 'AI_PROVIDER_INCOMPLETE_RESPONSE',
              retryable: true,
              metadata: { incompleteReason: 'max_output_tokens' },
            });
          }
          return { text: 'completed on retry', usage: {} };
        }
      }
    },
    policy: policy(),
    maxRetries: 1,
    retryDelayMs: 0,
  });

  const result = await router.route({
    task: 'response-composition',
    specialty: 'reasoning',
    reason: 'compose with bounded retry',
    role: 'guest',
    maxOutputTokens: 2000,
    messages: [{ role: 'user', content: 'long response please' }],
    traceContext,
  });

  assert.equal(result.text, 'completed on retry');
  assert.deepEqual(seenBudgets, [2000, 4000]);
});

test('OpenAI provider uses low reasoning effort for response composition to preserve output budget', async () => {
  let body = null;
  const provider = createOpenAIResponsesProvider({
    apiKey: 'test-key',
    reasoningEffort: 'medium',
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return {
        ok: true,
        async json() {
          return { status: 'completed', output_text: 'story', usage: {} };
        }
      };
    }
  });

  await provider.generate({
    request: {
      task: 'response-composition',
      messages: [{ role: 'user', content: 'story' }],
      maxOutputTokens: 8000,
      metadata: {},
    },
    model: { model: 'gpt-test' },
    signal: new AbortController().signal,
  });

  assert.equal(body.reasoning.effort, 'low');
  assert.equal(body.max_output_tokens, 8000);
});

test('final AI boundary failure is visible in application logs even when an upper layer catches it', async () => {
  const captured = [];
  const original = console.error;
  console.error = (line) => captured.push(String(line));
  try {
    const router = createAIRouter({
      registry: registry(),
      providers: {
        fake: {
          async generate() {
            throw new AIProviderError('OpenAI response was incomplete: max_output_tokens', {
              code: 'AI_PROVIDER_INCOMPLETE_RESPONSE',
              retryable: true,
              metadata: { incompleteReason: 'max_output_tokens' },
            });
          }
        }
      },
      policy: policy(),
      maxRetries: 0,
    });

    await assert.rejects(() => router.route({
      task: 'response-composition',
      specialty: 'reasoning',
      reason: 'prove application log visibility',
      role: 'guest',
      messages: [{ role: 'user', content: 'x' }],
      traceContext,
    }), (error) => error.code === 'AI_PROVIDER_INCOMPLETE_RESPONSE');
  } finally {
    console.error = original;
  }

  assert.equal(captured.length, 1);
  const event = JSON.parse(captured[0]);
  assert.equal(event.status, 'sg-runtime-failure');
  assert.equal(event.stage, 'ai-router');
  assert.equal(event.code, 'AI_PROVIDER_INCOMPLETE_RESPONSE');
  assert.equal(event.incompleteReason, 'max_output_tokens');
  assert.equal(event.traceId, traceContext.traceId);
  assert.equal(event.requestId, traceContext.requestId);
});
