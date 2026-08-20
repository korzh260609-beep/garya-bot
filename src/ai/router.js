import { createAIRequest, createAIResult, assertAIProvider } from './contracts.js';
import { AIConfigurationError, AIProviderError, AITimeoutError } from './errors.js';
import { redactSensitiveText } from '../secrets/redaction.js';
import {
  ProductionAiPolicyError,
  assertActualAiCostAllowed,
  assertProductionAiAllowed,
  estimateAiRequestCostUsd,
  resolveAiRole,
} from './productionPolicy.js';
import { createDeterministicTaskAssessor } from './taskAssessment.js';
import { createTierSelector } from './tierSelector.js';
import { createReasoningEffortSelector } from './reasoningEffortSelector.js';
import { createDeterministicOutputValidator } from './outputValidator.js';
import { createSemanticEscalationController } from './semanticEscalation.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RESPONSE_CONTEXT_TRUNCATION_MARKER = '\n...[SG_CONTEXT_TRUNCATED_TO_INPUT_BUDGET]...\n';
const RESPONSE_CONTEXT_MINIMUMS = Object.freeze([
  Object.freeze({ prefix: 'PROJECT_MEMORY_CONTEXT ', minimum: 300, priority: 1 }),
  Object.freeze({ prefix: 'DEVELOPMENT_QUERY_CONTEXT ', minimum: 300, priority: 2 }),
  Object.freeze({ prefix: 'SG_RESOLVED_CONTEXT ', minimum: 1200, priority: 3 }),
  Object.freeze({ prefix: 'IDENTITY_RESPONSE_CONTRACT ', minimum: 1600, priority: 4 }),
  Object.freeze({ prefix: 'CAPABILITY_RESULT ', minimum: 3500, priority: 5 }),
]);

function estimateCost(model, usage) {
  if (!usage) return null;
  const input = usage.inputTokens == null ? 0 : usage.inputTokens * model.inputCostPerMillion / 1_000_000;
  const output = usage.outputTokens == null ? 0 : usage.outputTokens * model.outputCostPerMillion / 1_000_000;
  const total = input + output;
  return Number.isFinite(total) ? total : null;
}
function messageCharacters(messages) {
  const list = messages ?? [];
  return list.reduce((total, message) => total + String(message?.content ?? '').length, 0) + Math.max(0, list.length - 1);
}
function responseDataRule(message) {
  if (message?.role !== 'system') return null;
  const content = String(message.content ?? '');
  return RESPONSE_CONTEXT_MINIMUMS.find((rule) => content.startsWith(rule.prefix)) ?? null;
}
function truncateResponseData(content, maximum) {
  const text = String(content ?? '');
  if (text.length <= maximum) return text;
  if (maximum <= RESPONSE_CONTEXT_TRUNCATION_MARKER.length + 40) return text.slice(0, maximum);
  const available = maximum - RESPONSE_CONTEXT_TRUNCATION_MARKER.length;
  const headLength = Math.max(20, Math.floor(available * 0.72));
  const tailLength = Math.max(20, available - headLength);
  return `${text.slice(0, headLength)}${RESPONSE_CONTEXT_TRUNCATION_MARKER}${text.slice(-tailLength)}`;
}
function preflightResponseCompositionInput(request, policy) {
  if (request?.task !== 'response-composition' || !policy?.maxInputCharacters) return request;
  const maximum = Number(policy.maxInputCharacters);
  if (!Number.isInteger(maximum) || maximum <= 0) return request;
  const originalCharacters = messageCharacters(request.messages);
  if (originalCharacters <= maximum) return request;

  const messages = request.messages.map((message) => ({ ...message }));
  const shrinkable = messages.map((message, index) => {
    const rule = responseDataRule(message);
    return rule ? { index, rule } : null;
  }).filter(Boolean);
  let guard = 0;
  while (messageCharacters(messages) > maximum && guard < 200) {
    guard += 1;
    const candidates = shrinkable.map(({ index, rule }) => ({
      index,
      rule,
      current: String(messages[index].content ?? '').length,
      reducible: Math.max(0, String(messages[index].content ?? '').length - rule.minimum)
    })).filter((entry) => entry.reducible > 0)
      .sort((left, right) => left.rule.priority - right.rule.priority || right.reducible - left.reducible);
    if (candidates.length === 0) break;
    const candidate = candidates[0];
    const overflow = messageCharacters(messages) - maximum;
    const reduction = Math.min(candidate.reducible, Math.max(overflow, Math.ceil(candidate.reducible * 0.35)));
    const target = candidate.current - reduction;
    messages[candidate.index].content = truncateResponseData(messages[candidate.index].content, target);
  }

  const finalCharacters = messageCharacters(messages);
  if (finalCharacters > maximum) return request;
  return createAIRequest({
    ...request,
    messages,
    metadata: {
      ...(request.metadata ?? {}),
      responseCompositionInputPreflight: Object.freeze({
        applied: true,
        originalCharacters,
        finalCharacters,
        maxInputCharacters: maximum,
        canonicalUserMessagePreserved: true
      })
    }
  });
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
  deterministicGate = null,
  taskAssessor = createDeterministicTaskAssessor(),
  tierSelector = createTierSelector(),
  reasoningEffortSelector = createReasoningEffortSelector(),
  outputValidator = createDeterministicOutputValidator(),
  semanticEscalation = createSemanticEscalationController(),
  timeoutMs = 30_000,
  maxRetries = 1,
  retryDelayMs = 100,
}) {
  if (!registry?.select || !registry?.get) throw new TypeError('registry is required');
  if (deterministicGate && typeof deterministicGate.tryExecute !== 'function') throw new TypeError('deterministicGate.tryExecute is required');
  if (!taskAssessor || typeof taskAssessor.assess !== 'function') throw new TypeError('taskAssessor.assess is required');
  if (!tierSelector || typeof tierSelector.select !== 'function') throw new TypeError('tierSelector.select is required');
  if (!reasoningEffortSelector || typeof reasoningEffortSelector.select !== 'function') throw new TypeError('reasoningEffortSelector.select is required');
  if (!outputValidator || typeof outputValidator.validate !== 'function') throw new TypeError('outputValidator.validate is required');
  if (!semanticEscalation || typeof semanticEscalation.decide !== 'function') throw new TypeError('semanticEscalation.decide is required');
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

  async function callModel(model, request, fallbackUsed, role, reasoningEffortSelection) {
    const provider = providerMap.get(model.provider);
    if (!provider) throw new AIProviderError(`AI provider is not registered: ${model.provider}`, { code: 'AI_PROVIDER_NOT_REGISTERED' });
    let lastError;
    let activeRequest = preflightResponseCompositionInput(request, policy);

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
          tier: model.tier,
          reasoningEffort: reasoningEffortSelection.effort,
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
        const validation = outputValidator.validate({ request: activeRequest, result });
        const validatedResult = createAIResult({ ...result, validation });
        telemetry?.record?.({
          type: 'ai.output.validated', traceId: activeRequest.traceContext.traceId,
          requestId: activeRequest.traceContext.requestId, taskClass: activeRequest.routing.taskClass,
          provider: model.provider, model: model.model, tier: model.tier,
          passed: validation.passed, failures: validation.failures, confidence: validation.confidence,
        });
        telemetry?.record?.({ type: 'ai.call.completed', role, ...validatedResult });
        return validatedResult;
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
      if (deterministicGate) {
        const deterministic = await deterministicGate.tryExecute(input);
        if (deterministic?.handled === true) return deterministic;
      }
      const assessment = await taskAssessor.assess({
        taskClass: input.routing?.taskClass ?? input.task,
        signals: input.taskAssessmentSignals ?? {},
        traceContext: input.traceContext,
      });
      const tierSelection = await tierSelector.select({
        taskClass: input.routing?.taskClass ?? input.task,
        assessment,
        trustedRoutingPolicy: input.trustedRoutingPolicy ?? null,
      });
      let request = createAIRequest({
        ...input,
        routing: { ...(input.routing ?? {}), assessment, tierSelection },
        maxOutputTokens: input.maxOutputTokens ?? defaultOutputBudget(input, policy),
      });
      telemetry?.record?.({
        type: 'ai.task.assessed',
        traceId: request.traceContext.traceId,
        requestId: request.traceContext.requestId,
        taskClass: request.routing.taskClass,
        assessment: request.routing.assessment,
      });
      telemetry?.record?.({
        type: 'ai.tier.selected', traceId: request.traceContext.traceId, requestId: request.traceContext.requestId,
        taskClass: request.routing.taskClass, ...request.routing.tierSelection
      });
      const role = resolveAiRole(input);
      async function executeTier(activeRequest, requiredTier, preferredModelId = null) {
        const requirements = Object.freeze({
          specialty: activeRequest.routing.specialty, requiredTier,
          requiredCapabilities: activeRequest.routing.requiredCapabilities,
        });
        const primary = registry.select({ ...requirements, preferredModelId });
        telemetry?.record?.({
          type: 'ai.model.selected', traceId: activeRequest.traceContext.traceId, requestId: activeRequest.traceContext.requestId,
          taskClass: activeRequest.routing.taskClass, requiredTier, selectedTier: primary.tier,
          provider: primary.provider, model: primary.model, specialty: requirements.specialty,
          requiredCapabilities: requirements.requiredCapabilities,
        });
        const selectEffort = (model) => reasoningEffortSelector.select({
          tier: requiredTier, assessment: activeRequest.routing.assessment, model,
          requestedEffort: activeRequest.routing.reasoningEffort, trustedRoutingPolicy: input.trustedRoutingPolicy ?? null,
        });
        const applyEffort = (selection) => createAIRequest({
          ...activeRequest,
          metadata: { ...activeRequest.metadata, ...(selection.effort ? { reasoningEffort: selection.effort } : {}) },
          routing: { ...activeRequest.routing, reasoningEffortSelection: selection },
        });
        const primaryEffort = selectEffort(primary);
        const primaryRequest = applyEffort(primaryEffort);
        telemetry?.record?.({
          type: 'ai.reasoning-effort.selected', traceId: primaryRequest.traceContext.traceId, requestId: primaryRequest.traceContext.requestId,
          taskClass: primaryRequest.routing.taskClass, selectedTier: primary.tier, ...primaryEffort,
        });
        try {
          return await callModel(primary, primaryRequest, false, role, primaryEffort);
        } catch (primaryError) {
          const technical = primaryError instanceof AIProviderError || primaryError instanceof AITimeoutError;
          if (primaryError instanceof ProductionAiPolicyError || !technical || !primary.fallbackId) throw primaryError;
          telemetry?.record?.({
            type: 'ai.fallback.used', traceId: primaryRequest.traceContext.traceId,
            requestId: primaryRequest.traceContext.requestId, fromModel: primary.id, toModel: primary.fallbackId,
            role, reason: primaryRequest.reason, primaryErrorCode: primaryError.code ?? 'AI_PROVIDER_ERROR',
          });
          const fallback = registry.select({ ...requirements, preferredModelId: primary.fallbackId });
          const fallbackEffort = selectEffort(fallback);
          const fallbackRequest = applyEffort(fallbackEffort);
          telemetry?.record?.({
            type: 'ai.reasoning-effort.selected', traceId: fallbackRequest.traceContext.traceId, requestId: fallbackRequest.traceContext.requestId,
            taskClass: fallbackRequest.routing.taskClass, selectedTier: fallback.tier, fallbackUsed: true, ...fallbackEffort,
          });
          return callModel(fallback, fallbackRequest, true, role, fallbackEffort);
        }
      }

      let result = await executeTier(request, request.routing.tierSelection.tier, input.preferredModelId);
      const promotions = [];
      while (true) {
        const decision = semanticEscalation.decide({
          result, currentTier: result.tier, maximumTier: input.trustedRoutingPolicy?.maximumTier ?? null,
          promotionCount: promotions.length,
        });
        if (!decision.escalate) {
          return createAIResult({ ...result, escalation: {
            version: 'AR2.9', used: promotions.length > 0, promotions: Object.freeze(promotions), terminalReason: decision.reason,
          } });
        }
        promotions.push(Object.freeze({ fromTier: decision.fromTier, toTier: decision.toTier, reason: decision.reason }));
        telemetry?.record?.({
          type: 'ai.semantic-escalation.used', traceId: request.traceContext.traceId, requestId: request.traceContext.requestId,
          taskClass: request.routing.taskClass, fromTier: decision.fromTier, toTier: decision.toTier,
          promotion: decision.promotion, reason: decision.reason, validationFailures: result.validation.failures,
        });
        request = createAIRequest({
          ...request,
          messages: [...request.messages, { role: 'system', content: `AR2_SEMANTIC_ESCALATION ${JSON.stringify({
            reason: decision.reason, validation: decision.priorResult.validation,
            priorResult: decision.priorResult.text, priorResultTruncated: decision.priorResult.truncated,
          })}` }],
          metadata: { ...request.metadata, semanticEscalation: decision },
          routing: { ...request.routing, tierSelection: { ...request.routing.tierSelection, tier: decision.toTier, reason: decision.reason } },
        });
        try {
          result = await executeTier(request, decision.toTier);
        } catch (error) {
          if (!(error instanceof AIConfigurationError)) throw error;
          return createAIResult({ ...result, escalation: {
            version: 'AR2.9', used: promotions.length > 0, promotions: Object.freeze(promotions),
            terminalReason: 'higher-tier-unavailable',
          } });
        }
      }
    },
  });
}
