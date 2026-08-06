import { createAIRequest, createAIResult, assertAIProvider } from './contracts.js';
import { AIProviderError, AITimeoutError } from './errors.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function estimateCost(model, usage) {
  if (!usage) return null;
  const input = usage.inputTokens == null ? 0 : usage.inputTokens * model.inputCostPerMillion / 1_000_000;
  const output = usage.outputTokens == null ? 0 : usage.outputTokens * model.outputCostPerMillion / 1_000_000;
  return input + output || null;
}

async function withTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AITimeoutError(`AI provider timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      timeout
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function createAIRouter({ registry, providers, telemetry = null, timeoutMs = 30_000, maxRetries = 1, retryDelayMs = 100 }) {
  if (!registry?.select || !registry?.get) throw new TypeError('registry is required');
  const providerMap = new Map(Object.entries(providers ?? {}).map(([name, provider]) => [name, assertAIProvider(provider)]));

  async function callModel(model, request, fallbackUsed) {
    const provider = providerMap.get(model.provider);
    if (!provider) throw new AIProviderError(`AI provider is not registered: ${model.provider}`, { code: 'AI_PROVIDER_NOT_REGISTERED' });
    let lastError;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      const startedAt = Date.now();
      telemetry?.record?.({
        type: 'ai.call.started', traceId: request.traceContext.traceId, requestId: request.traceContext.requestId,
        provider: model.provider, model: model.model, reason: request.reason, attempt
      });
      try {
        const raw = await withTimeout((signal) => provider.generate({ request, model, signal }), timeoutMs);
        const result = createAIResult({
          ...raw,
          provider: model.provider,
          model: model.model,
          latencyMs: raw.latencyMs ?? Date.now() - startedAt,
          costUsd: raw.costUsd ?? estimateCost(model, raw.usage),
          traceId: request.traceContext.traceId,
          requestId: request.traceContext.requestId,
          reason: request.reason,
          attempts: attempt,
          fallbackUsed
        });
        telemetry?.record?.({ type: 'ai.call.completed', ...result });
        return result;
      } catch (cause) {
        lastError = cause instanceof Error ? cause : new AIProviderError('Unknown AI provider failure');
        telemetry?.record?.({
          type: 'ai.call.failed', traceId: request.traceContext.traceId, requestId: request.traceContext.requestId,
          provider: model.provider, model: model.model, reason: request.reason, attempt,
          code: lastError.code ?? 'AI_PROVIDER_ERROR', retryable: Boolean(lastError.retryable)
        });
        if (!lastError.retryable || attempt > maxRetries) break;
        await sleep(retryDelayMs * attempt);
      }
    }
    throw lastError;
  }

  return Object.freeze({
    async route(input) {
      const request = createAIRequest(input);
      const primary = registry.select({ specialty: input.specialty ?? 'reasoning', preferredModelId: input.preferredModelId });
      try {
        return await callModel(primary, request, false);
      } catch (primaryError) {
        if (!primary.fallbackId) throw primaryError;
        telemetry?.record?.({
          type: 'ai.fallback.used', traceId: request.traceContext.traceId, requestId: request.traceContext.requestId,
          fromModel: primary.id, toModel: primary.fallbackId, reason: request.reason
        });
        return callModel(registry.get(primary.fallbackId), request, true);
      }
    }
  });
}
