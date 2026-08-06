import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIRouter } from '../src/ai/router.js';
import { createModelRegistry } from '../src/ai/modelRegistry.js';
import { createOpenAIResponsesProvider } from '../src/ai/providers/openaiResponsesProvider.js';
import { createProductionMeaningInterpreter } from '../src/ai/productionMeaningInterpreter.js';
import { AIConfigurationError, AIProviderError, AITimeoutError } from '../src/ai/errors.js';

const traceContext = { traceId: 'trace-failure', requestId: 'request-failure' };

function oneModelRegistry(extra = {}) {
  return createModelRegistry([{
    id: 'primary',
    provider: 'fake',
    model: 'reasoner',
    specialties: ['reasoning', 'semantic-interpretation'],
    ...extra
  }]);
}

test('OpenAI provider fails explicitly when credentials are missing', () => {
  assert.throws(
    () => createOpenAIResponsesProvider({ apiKey: '', fetchImpl: async () => ({}) }),
    AIConfigurationError
  );
});

test('OpenAI provider sends secret-safe Responses API request and normalizes usage', async () => {
  let captured;
  const provider = createOpenAIResponsesProvider({
    apiKey: 'test-key',
    reasoningEffort: 'medium',
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        async json() {
          return {
            id: 'resp-test',
            output_text: '{"ok":true}',
            usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 }
          };
        }
      };
    }
  });

  const result = await provider.generate({
    request: {
      messages: [{ role: 'user', content: 'hello' }],
      responseFormat: {
        name: 'test_schema',
        jsonSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['ok'],
          properties: { ok: { type: 'boolean' } }
        }
      }
    },
    model: { model: 'gpt-test' },
    signal: new AbortController().signal
  });

  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.body.store, false);
  assert.equal(captured.body.reasoning.effort, 'medium');
  assert.equal(captured.body.text.format.type, 'json_schema');
  assert.equal(captured.options.headers.authorization, 'Bearer test-key');
  assert.equal(result.usage.totalTokens, 14);
  assert.equal(result.rawMetadata.responseId, 'resp-test');
});

test('OpenAI provider marks rate-limit failures retryable', async () => {
  const provider = createOpenAIResponsesProvider({
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      async json() { return { error: { message: 'rate limited' } }; }
    })
  });

  await assert.rejects(
    () => provider.generate({
      request: { messages: [{ role: 'user', content: 'hello' }], responseFormat: null },
      model: { model: 'gpt-test' },
      signal: new AbortController().signal
    }),
    (error) => error instanceof AIProviderError && error.retryable === true && error.code === 'AI_PROVIDER_HTTP_429'
  );
});

test('router enforces timeout even when provider ignores AbortSignal', async () => {
  const router = createAIRouter({
    registry: oneModelRegistry(),
    providers: { fake: { async generate() { return new Promise(() => {}); } } },
    timeoutMs: 5,
    maxRetries: 0
  });

  await assert.rejects(
    () => router.route({
      task: 'timeout-test',
      reason: 'prove hard timeout',
      messages: [{ role: 'user', content: 'x' }],
      traceContext
    }),
    AITimeoutError
  );
});

test('specialized model is selected before generic reasoning model', async () => {
  const registry = createModelRegistry([
    { id: 'generic', provider: 'generic', model: 'generic-model', specialties: ['reasoning'] },
    { id: 'semantic', provider: 'semantic', model: 'semantic-model', specialties: ['semantic-interpretation'] }
  ]);
  const router = createAIRouter({
    registry,
    providers: {
      generic: { async generate() { return { text: 'generic' }; } },
      semantic: { async generate() { return { text: 'semantic' }; } }
    },
    maxRetries: 0
  });

  const result = await router.route({
    task: 'selection-test',
    specialty: 'semantic-interpretation',
    reason: 'prove specialized-first routing',
    messages: [{ role: 'user', content: 'x' }],
    traceContext
  });

  assert.equal(result.model, 'semantic-model');
});

test('production MeaningInterpreter does not accept a raw provider bypass', () => {
  assert.throws(
    () => createProductionMeaningInterpreter({ aiRouter: { generate() {} } }),
    TypeError
  );
});
