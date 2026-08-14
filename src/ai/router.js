import { createAIRequest, createAIResult, assertAIProvider } from './contracts.js';
import { AIProviderError, AITimeoutError } from './errors.js';
import { redactSensitiveText } from '../secrets/redaction.js';
import {
  ProductionAiPolicyError,
  assertActualAiCostAllowed,
  assertProductionAiAllowed,
  estimateAiRequestCostUsd,
  resolveAiRole,
} from './productionPolicy.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function estimateCost(model, usage) {
  if (!usage) return null;
  const input = usage.inputTokens == null ? 0 : usage.inputTokens * model.inputCostPerMillion / 1_000_000;
  const output = usage.outputTokens == null ? 0 : usage.outputTokens * model.outputCostPerMillion / 1_000_000;
  const total = input + output;
  return Number.isFinite(total) ? total : null;
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
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function defaultOutputBudget(input, policy) {
  if (!policy) return null;
  if (input.task === 'language-detection') return policy.outputTokenBudgets?.languageDetection ?? policy.maxOutputTokens;
  if (input.task === 'semantic-interpretation') return policy.outputTokenBudgets?.semanticInterpretation ?? policy.maxOutputTokens;
  if (input.task === 'response-composition') return policy.outputTokenBudgets?.responseComposition ?? policy.maxOutputTokens;
  return policy.maxOutputTokens ?? null;
}

function retryRequestAfterFailure(request, error, policy) {
  if (error?.code !== 'AI_PROVIDER_INCOMPLETE_RESPONSE' || error?.metadata?.incompleteReason !== 'max_output_tokens') return request;
  const current = Number(request.maxOutputTokens ?? 0);
  if (!Number.isInteger(current) || current <= 0) return request;
  const configuredCeiling = Math.max(
    Number(policy?.outputTokenBudgets?.responseComposition ?? 0),
    Number(policy?.outputTokenBudgets?.semanticInterpretation ?? 0),
    Number(policy?.maxOutputTokens ?? 0),
    current * 2
  );
  const next = Math.min(configuredCeiling, current * 2);
  if (next <= current) return request;
  return createAIRequest({ ...request, maxOutputTokens: next });
}

function emitAiBoundaryFailure(request, error) {
  try {
    console.error(JSON.stringify({
      status: 'sg-runtime-failure',
      traceId: request?.traceContext?.traceId ?? null,
      requestId: request?.traceContext?.requestId ?? null,
      stage: 'ai-router',
      code: error?.code ?? 'AI_PROVIDER_ERROR',
      reason: redactSensitiveText(error?.message ?? 'AI provider failure'),
      incompleteReason: error?.metadata?.incompleteReason ?? null,
      retryable: Boolean(error?.retryable),
    }));
  } catch {}
}

export function createAIRouter({
  registry,
  providers,
  telemetry = null,
  policy = null,
  timeoutMs = 30_000,
  maxRetries = 1,
  retryDelayMs = 100,
}) {
  if (!registry?.select || !registry?.get) throw new TypeError('registry is required');
  const providerMap = new Map(Object.entries(providers ?? {}).map(([name, provider]) => [name, assertAIProvider(provider)]));

  function enforcePolicy({ model, request, role }) {
    if (!policy) return null;
    const estimatedCostUsd = estimateAiRequestCostUsd({
      model,
      messages: request.messages,
      maxOutputTokens: request.maxOutputTokens ?? policy.maxOutputTokens,
    });
    const evidence = assertProductionAiAllowed({
      policy,
      role,
      estimatedCostUsd,
      inputText: request.messages.map((message) => message.content).join('\n'),
      context: request.metadata?.context ?? null,
      reason: request.reason,
    });
    telemetry?.record?.({
      type: 'ai.policy.allowed',
      traceId: request.traceContext.traceId,
      requestId: request.traceContext.requestId,
      provider: model.provider,
      model: model.model,
      role,
      reason: request.reason,
      estimatedCostUsd,
      limitUsd: evidence.limitUsd,
      maxOutputTokens: request.maxOutputTokens,
    });
    return evidence;
  }

  async function callModel(model, request, fallbackUsed, role) {
    const provider = providerMap.get(model.provider);
    if (!provider) throw new AIProviderError(`AI provider is not registered: ${model.provider}`, { code: 'AI_PROVIDER_NOT_REGISTERED' });
    let lastError;
    let activeRequest = request;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      enforcePolicy({ model, request: activeRequest, role });
      const startedAt = Date.now();
      telemetry?.record?.({
        type: 'ai.call.started',
        traceId: activeRequest.traceContext.traceId,
        requestId: activeRequest.traceContext.requestId,
        provider: model.provider,
        model: model.model,
        role,
        reason: activeRequest.reason,
        attempt,
        maxOutputTokens: activeRequest.maxOutputTokens,
      });
      try {
        const raw = await withTimeout((signal) => provider.generate({ request: activeRequest, model, signal }), timeoutMs);
        const result = createAIResult({
          ...raw,
          provider: model.provider,
          model: model.model,
          latencyMs: raw.latencyMs ?? Date.now() - startedAt,
          costUsd: raw.costUsd ?? estimateCost(model, raw.usage),
          traceId: activeRequest.traceContext.traceId,
          requestId: activeRequest.traceContext.requestId,
          reason: activeRequest.reason,
          attempts: attempt,
          fallbackUsed,
        });
        if (policy && result.costUsd != null) {
          assertActualAiCostAllowed({ policy, role, actualCostUsd: result.costUsd });
        }
        telemetry?.record?.({ type: 'ai.call.completed', role, ...result });
        return result;
      } catch (cause) {
        lastError = cause instanceof Error ? cause : new AIProviderError('Unknown AI provider failure');
        telemetry?.record?.({
          type: 'ai.call.failed',
          traceId: activeRequest.traceContext.traceId,
          requestId: activeRequest.traceContext.requestId,
          provider: model.provider,
          model: model.model,
          role,
          reason: activeRequest.reason,
          attempt,
          code: lastError.code ?? 'AI_PROVIDER_ERROR',
          retryable: Boolean(lastError.retryable),
          incompleteReason: lastError.metadata?.incompleteReason ?? null,
          maxOutputTokens: activeRequest.maxOutputTokens,
        });
        if (!lastError.retryable || attempt > maxRetries) break;
        activeRequest = retryRequestAfterFailure(activeRequest, lastError, policy);
        await sleep(retryDelayMs * attempt);
      }
    }
    emitAiBoundaryFailure(activeRequest, lastError);
    throw lastError;
  }

  return Object.freeze({
    async route(input) {
      const request = createAIRequest({
        ...input,
        maxOutputTokens: input.maxOutputTokens ?? defaultOutputBudget(input, policy),
      });
      const role = resolveAiRole(input);
      const primary = registry.select({ specialty: input.specialty ?? 'reasoning', preferredModelId: input.preferredModelId });
      try {
        return await callModel(primary, request, false, role);
      } catch (primaryError) {
        if (primaryError instanceof ProductionAiPolicyError || !primary.fallbackId) throw primaryError;
        telemetry?.record?.({
          type: 'ai.fallback.used',
          traceId: request.traceContext.traceId,
          requestId: request.traceContext.requestId,
          fromModel: primary.id,
          toModel: primary.fallbackId,
          role,
          reason: request.reason,
          primaryErrorCode: primaryError.code ?? 'AI_PROVIDER_ERROR',
        });
        return callModel(registry.get(primary.fallbackId), request, true, role);
      }
    },
  });
}
