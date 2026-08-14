import { createCapabilityExecutionRequest, createCapabilityResult } from '../contracts/capability.js';

function errorRecord(error, fallbackCode = 'capability-failed') {
  return Object.freeze({ code: error?.code ?? fallbackCode, message: error?.message ?? String(error ?? 'Capability failed'), retryable: Boolean(error?.retryable) });
}

function executionFailure(result) {
  const error = new Error(result?.error?.message ?? `Capability ${result?.capability ?? 'unknown'} failed`);
  error.code = result?.error?.code ?? 'capability-failed';
  error.retryable = Boolean(result?.error?.retryable);
  return error;
}

function failureMessage(locale) {
  const language = String(locale ?? 'en').toLowerCase();
  if (language.startsWith('uk')) return 'Не вдалося виконати дію. Деталі помилки зафіксовані в діагностиці.';
  if (language.startsWith('ru')) return 'Не удалось выполнить действие. Детали ошибки зафиксированы в диагностике.';
  return 'The action could not be completed. Error details were recorded in diagnostics.';
}

function failureData(data, actionRequest) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message.trim() !== '') return data;
    if (typeof data.text === 'string' && data.text.trim() !== '') return data;
    return Object.freeze({ ...data, message: failureMessage(actionRequest?.payload?.locale) });
  }
  return Object.freeze({ message: failureMessage(actionRequest?.payload?.locale) });
}

function ensureFailureMessage(output, actionRequest) {
  if (!['failed', 'timeout', 'unavailable'].includes(output?.status)) return output;
  return { ...output, data: failureData(output.data, actionRequest) };
}

function executionLimits(capability, policyContext) {
  const policy = policyContext?.policy?.capability;
  return Object.freeze({
    timeoutMs: policy?.maxTimeoutMs == null ? capability.timeoutMs : Math.min(capability.timeoutMs, policy.maxTimeoutMs),
    maxRetries: policy?.maxRetries == null ? capability.maxRetries : Math.min(capability.maxRetries, policy.maxRetries)
  });
}

async function executeWithTimeout(capability, request, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(capability.execute(request, { signal: controller.signal })),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const error = new Error(`Capability timed out after ${timeoutMs}ms`);
          error.code = 'capability-timeout'; error.retryable = true; reject(error);
        }, timeoutMs);
      })
    ]);
  } finally { clearTimeout(timer); }
}

function normalizedOutput(output, capability) {
  if (!output || typeof output !== 'object') return { status: 'success', data: output };
  return { status: output.status ?? 'success', data: output.data ?? null, error: output.error ?? null, warnings: output.warnings ?? [], sources: output.sources ?? capability.requiredSources, tools: output.tools ?? capability.requiredTools, costUsd: output.costUsd ?? capability.estimatedCostUsd };
}

function declaredRequirementsCovered(capability, actionRequest) {
  const declaredPermissions = new Set([actionRequest.requiredPermission].filter(Boolean));
  const declaredSources = new Set(actionRequest.requiredSources ?? []);
  const declaredTools = new Set(actionRequest.requiredTools ?? []);
  return capability.requiredPermissions.every((value) => declaredPermissions.has(value))
    && capability.requiredSources.every((value) => declaredSources.has(value))
    && capability.requiredTools.every((value) => declaredTools.has(value));
}

export function createCapabilityExecutor({ registry, clock = () => Date.now() } = {}) {
  if (!registry?.discover || !registry?.get) throw new TypeError('registry is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function run(capability, actionRequest, gateDecision, fallbackFrom, attempts, policyContext) {
    const limits = executionLimits(capability, policyContext);
    for (let attempt = 1; attempt <= limits.maxRetries + 1; attempt += 1) {
      const startedAt = clock();
      const request = createCapabilityExecutionRequest({ capability, actionRequest, gateDecision, attempt, fallbackFrom });
      try {
        const output = normalizedOutput(await executeWithTimeout(capability, request, limits.timeoutMs), capability);
        const durationMs = Math.max(0, clock() - startedAt);
        attempts.push(Object.freeze({ capability: capability.name, attempt, status: output.status, durationMs }));
        if ((output.status === 'failed' || output.status === 'timeout' || output.status === 'unavailable') && output.error?.retryable && attempt <= limits.maxRetries) continue;
        const completed = ensureFailureMessage(output, actionRequest);
        return createCapabilityResult({ ...completed, capability: capability.name, durationMs, attempts, fallbackUsed: fallbackFrom ? capability.name : null, traceContext: actionRequest.traceContext });
      } catch (error) {
        const durationMs = Math.max(0, clock() - startedAt); const timedOut = error?.code === 'capability-timeout';
        attempts.push(Object.freeze({ capability: capability.name, attempt, status: timedOut ? 'timeout' : 'failed', durationMs }));
        if (Boolean(error?.retryable) && attempt <= limits.maxRetries) continue;
        const failure = errorRecord(error, timedOut ? 'capability-timeout' : 'capability-failed');
        return createCapabilityResult({ status: timedOut ? 'timeout' : 'failed', capability: capability.name, data: failureData(null, actionRequest), error: failure, durationMs, attempts, fallbackUsed: fallbackFrom ? capability.name : null, traceContext: actionRequest.traceContext });
      }
    }
    throw new Error('unreachable capability execution state');
  }

  return Object.freeze({
    async execute({ actionRequest, gateDecision, policyContext = null }) {
      if (gateDecision?.outcome !== 'allow' || gateDecision.authorized !== true) throw new TypeError('Capability execution requires an allowed GateDecision');
      const candidates = registry.discover(actionRequest);
      if (candidates.length === 0) return createCapabilityResult({ status: 'unavailable', capability: actionRequest.capability, data: failureData(null, actionRequest), error: { code: 'capability-unavailable', message: 'No matching capability is registered', retryable: false }, traceContext: actionRequest.traceContext });

      const primary = candidates.map((entry) => entry.capability).find((capability) => declaredRequirementsCovered(capability, actionRequest));
      if (!primary) return createCapabilityResult({ status: 'unavailable', capability: actionRequest.capability, data: failureData(null, actionRequest), error: { code: 'capability-requirements-not-authorized', message: 'Capability requirements were not covered by Action Gate', retryable: false }, traceContext: actionRequest.traceContext });
      const attempts = [];
      let result = await run(primary, actionRequest, gateDecision, null, attempts, policyContext);
      if (result.status === 'success' || result.status === 'partial') return result;

      for (const fallbackName of primary.fallbackCapabilities) {
        const fallback = registry.get(fallbackName);
        if (!fallback || !fallback.actionClasses.includes(actionRequest.actionClass) || !declaredRequirementsCovered(fallback, actionRequest)) continue;
        result = await run(fallback, actionRequest, gateDecision, primary.name, attempts, policyContext);
        if (result.status === 'success' || result.status === 'partial') return result;
      }

      if (primary.name === 'compose-answer') throw executionFailure(result);
      return result;
    }
  });
}
