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

function resolveStructuredOutputStrict(value) {
  if (value == null) return true;
  if (typeof value !== 'boolean') throw new AIConfigurationError('responseFormat.strict must be a boolean');
  return value;
}

function boundedProviderField(value, maxLength = 160) {
  if (value == null) return null;
  const text = String(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function createOpenAIResponsesProvider({
  apiKey = null,
  credentialManager = null,
  credentialAccessContext = null,
  credentialId = 'sg.openai.primary',
  connectionRegistry = null,
  connectionAccessContext = null,
  connectionId = 'openai',
  baseUrl = 'https://api.openai.com/v1',
  reasoningEffort = 'medium',
  fetchImpl = globalThis.fetch,
} = {}) {
  const hasCredentialManager = credentialManager && typeof credentialManager.useCredential === 'function';
  if (!hasCredentialManager && (typeof apiKey !== 'string' || apiKey.trim() === '')) throw new AIConfigurationError('OpenAI credential is required');
  if (hasCredentialManager && (!credentialAccessContext?.actor || !credentialAccessContext?.scope)) throw new AIConfigurationError('OpenAI credential access context is required');
  if (connectionRegistry && typeof connectionRegistry.requireUsable !== 'function') throw new AIConfigurationError('OpenAI connection registry is invalid');
  if (connectionRegistry && (!connectionAccessContext?.actor || !connectionAccessContext?.projectScope)) throw new AIConfigurationError('OpenAI connection access context is required');
  if (typeof fetchImpl !== 'function') throw new AIConfigurationError('fetch implementation is required');

  async function generateWithKey(secret, { request, model, signal }) {
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
          strict: resolveStructuredOutputStrict(request.responseFormat.strict),
          schema: request.responseFormat.jsonSchema,
        },
      };
    }

    let response;
    try {
      response = await fetchImpl(`${baseUrl}/responses`, {
        method: 'POST', signal,
        headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      if (signal?.aborted) throw cause;
      throw new AIProviderError('OpenAI network request failed', { cause, retryable: true, code: 'AI_PROVIDER_NETWORK' });
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      throw new AIProviderError(`OpenAI request failed with status ${response.status}`, {
        retryable,
        code: `AI_PROVIDER_HTTP_${response.status}`,
        metadata: {
          status: response.status,
          providerCode: boundedProviderField(payload.error?.code),
          providerType: boundedProviderField(payload.error?.type),
          providerParam: boundedProviderField(payload.error?.param),
          requestId: boundedProviderField(response.headers?.get?.('x-request-id') ?? payload.request_id),
        },
      });
    }

    return {
      text: extractText(payload), latencyMs: Date.now() - startedAt,
      usage: { inputTokens: payload.usage?.input_tokens ?? null, outputTokens: payload.usage?.output_tokens ?? null, totalTokens: payload.usage?.total_tokens ?? null },
      rawMetadata: { responseId: payload.id ?? null },
    };
  }

  return Object.freeze({
    name: 'openai',
    async generate(input) {
      if (connectionRegistry) await connectionRegistry.requireUsable({ connectionId, capability: 'ai.responses', actor: connectionAccessContext.actor, projectScope: connectionAccessContext.projectScope });
      if (!hasCredentialManager) return generateWithKey(apiKey.trim(), input);
      return credentialManager.useCredential({ credentialId, actor: credentialAccessContext.actor, scope: credentialAccessContext.scope, purpose: 'openai.responses.generate', connectionId, operation: (secret) => generateWithKey(secret, input) });
    },
  });
}
