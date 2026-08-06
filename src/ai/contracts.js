import { AIOutputValidationError } from './errors.js';

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function string(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function nonNegative(value, field) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${field} must be a non-negative number`);
  return number;
}
export function assertAIProvider(provider) {
  if (!provider || typeof provider.generate !== 'function') throw new TypeError('AI provider generate must be a function');
  return provider;
}
export function createAIRequest(input) {
  object(input, 'AI request');
  return Object.freeze({
    task: string(input.task, 'task'),
    reason: string(input.reason, 'reason'),
    messages: Object.freeze((input.messages ?? []).map((message, index) => Object.freeze({
      role: string(message.role, `messages[${index}].role`),
      content: string(message.content, `messages[${index}].content`)
    }))),
    responseFormat: input.responseFormat ? Object.freeze({ ...object(input.responseFormat, 'responseFormat') }) : null,
    traceContext: Object.freeze({ ...object(input.traceContext, 'traceContext') }),
    metadata: Object.freeze({ ...(input.metadata ?? {}) })
  });
}
export function createAIResult(input) {
  object(input, 'AI result');
  return Object.freeze({
    text: string(input.text, 'text'),
    provider: string(input.provider, 'provider'),
    model: string(input.model, 'model'),
    latencyMs: nonNegative(input.latencyMs, 'latencyMs'),
    usage: Object.freeze({
      inputTokens: nonNegative(input.usage?.inputTokens, 'usage.inputTokens'),
      outputTokens: nonNegative(input.usage?.outputTokens, 'usage.outputTokens'),
      totalTokens: nonNegative(input.usage?.totalTokens, 'usage.totalTokens')
    }),
    costUsd: nonNegative(input.costUsd, 'costUsd'),
    traceId: string(input.traceId, 'traceId'),
    requestId: string(input.requestId, 'requestId'),
    reason: string(input.reason, 'reason'),
    attempts: nonNegative(input.attempts ?? 1, 'attempts'),
    fallbackUsed: Boolean(input.fallbackUsed),
    rawMetadata: Object.freeze({ ...(input.rawMetadata ?? {}) })
  });
}
export function parseStructuredAIOutput(result) {
  try {
    return object(JSON.parse(result.text), 'structured AI output');
  } catch (cause) {
    if (cause instanceof AIOutputValidationError) throw cause;
    throw new AIOutputValidationError('AI provider returned invalid JSON', { cause });
  }
}
