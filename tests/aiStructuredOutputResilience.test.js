import test from 'node:test';
import assert from 'node:assert/strict';

import { parseStructuredAIOutput } from '../src/ai/contracts.js';
import { AIOutputValidationError, AIProviderError } from '../src/ai/errors.js';
import { createOpenAIResponsesProvider } from '../src/ai/providers/openaiResponsesProvider.js';

function providerInput() {
  return {
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
  };
}

test('structured parser accepts a complete JSON document with BOM or a single JSON fence', () => {
  assert.deepEqual(parseStructuredAIOutput({ text: '\uFEFF {"ok":true}' }), { ok: true });
  assert.deepEqual(parseStructuredAIOutput({ text: '```json\n{"ok":true}\n```' }), { ok: true });
});

test('structured parser does not extract JSON from arbitrary surrounding prose', () => {
  assert.throws(
    () => parseStructuredAIOutput({ text: 'Here is the result: {"ok":true}' }),
    AIOutputValidationError
  );
});

test('OpenAI provider rejects incomplete Responses API results before structured parsing', async () => {
  const provider = createOpenAIResponsesProvider({
    apiKey: 'test-key',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      async json() {
        return {
          id: 'resp-incomplete',
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          output_text: '{"ok":',
          usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 }
        };
      }
    })
  });

  await assert.rejects(
    () => provider.generate(providerInput()),
    (error) => error instanceof AIProviderError
      && error.code === 'AI_PROVIDER_INCOMPLETE_RESPONSE'
      && error.retryable === true
  );
});
