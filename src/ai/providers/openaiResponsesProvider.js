import { AIConfigurationError, AIProviderError } from '../errors.js';

function extractText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  const parts = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') parts.push(content.text);
    }
  }
  if (!parts.length) throw new AIProviderError('OpenAI response contains no text', { code: 'AI_PROVIDER_EMPTY_RESPONSE' });
  return parts.join('').trim();
}

export function createOpenAIResponsesProvider({
  apiKey = process.env.OPENAI_API_KEY,
  baseUrl = 'https://api.openai.com/v1',
  reasoningEffort = 'medium',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) throw new AIConfigurationError('OPENAI_API_KEY is required');
  if (typeof fetchImpl !== 'function') throw new AIConfigurationError('fetch implementation is required');

  return Object.freeze({
    name: 'openai',
    async generate({ request, model, signal }) {
      const startedAt = Date.now();
      const body = {
        model: model.model,
        input: request.messages.map((message) => ({ role: message.role, content: message.content })),
        reasoning: { effort: reasoningEffort },
        store: false,
      };
      if (request.maxOutputTokens != null) body.max_output_tokens = request.maxOutputTokens;
      if (request.responseFormat?.jsonSchema) {
        body.text = {
          format: {
            type: 'json_schema',
            name: request.responseFormat.name ?? 'sg_output',
            strict: true,
            schema: request.responseFormat.jsonSchema,
          },
        };
      }

      let response;
      try {
        response = await fetchImpl(`${baseUrl}/responses`, {
          method: 'POST',
          signal,
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (cause) {
        if (signal?.aborted) throw cause;
        throw new AIProviderError('OpenAI network request failed', {
          cause,
          retryable: true,
          code: 'AI_PROVIDER_NETWORK',
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
        throw new AIProviderError(payload.error?.message ?? `OpenAI request failed with status ${response.status}`, {
          retryable,
          code: `AI_PROVIDER_HTTP_${response.status}`,
          metadata: { status: response.status },
        });
      }

      return {
        text: extractText(payload),
        latencyMs: Date.now() - startedAt,
        usage: {
          inputTokens: payload.usage?.input_tokens ?? null,
          outputTokens: payload.usage?.output_tokens ?? null,
          totalTokens: payload.usage?.total_tokens ?? null,
        },
        rawMetadata: { responseId: payload.id ?? null },
      };
    },
  });
}
