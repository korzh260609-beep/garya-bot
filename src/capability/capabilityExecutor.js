import { createCapabilityExecutionRequest, createCapabilityResult } from '../contracts/capability.js';

function errorRecord(error, fallbackCode = 'capability-failed') {
  return Object.freeze({
    code: error?.code ?? fallbackCode,
    message: error?.message ?? String(error ?? 'Capability failed'),
    retryable: Boolean(error?.retryable)
  });
}

async function executeWithTimeout(capability, request) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(capability.execute(request, { signal: controller.signal })),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const error = new Error(`Capability timed out after ${capability.timeoutMs}ms`);
          error.code = 'capability-timeout';
          error.retryable = true;
          reject(error);
        }, capability.timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function normalizedOutput(output, capability) {
  if (!output || typeof output !== 'object') return { status: 'success', data: output };
  return {
    status: output.status ?? 'success',
    data: output.data ?? null,
    error: output.error ?? null,
    warnings: output.warnings ?? [],
    sources: output.sources ?? capability.requiredSources,
    tools: output.tools ?? capability.requiredTools,
    costUsd: output.costUsd ?? capability.estimatedCostUsd
  };
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

  async function run(capability, actionRequest, gateDecision, fallbackFrom, attempts) {
    for (let attempt = 1; attempt <= capability.maxRetries + 1; attempt += 1) {
      const startedAt = clock();
      const request = createCapabilityExecutionRequest({ capability, actionRequest, gateDecision, attempt, fallbackFrom });
      try {
        const output = normalizedOutput(await executeWithTimeout(capability, request), capability);
        const durationMs = Math.max(0, clock() - startedAt);
        attempts.push(Object.freeze({ capability: capability.name, attempt, status: output.status, durationMs }));
        if ((output.status === 'failed' || output.status === 'timeout' || output.status === 'unavailable') && output.error?.retryable && attempt <= capability.maxRetries) continue;
        return createCapabilityResult({
          ...output,
          capability: capability.name,
          durationMs,
          attempts,
          fallbackUsed: fallbackFrom ? capability.name : null,
          traceContext: actionRequest.traceContext
        });
      } catch (error) {
        const durationMs = Math.max(0, clock() - startedAt);
        const timedOut = error?.code === 'capability-timeout';
        attempts.push(Object.freeze({ capability: capability.name, attempt, status: timedOut ? 'timeout' : 'failed', durationMs }));
        if (Boolean(error?.retryable) && attempt <= capability.maxRetries) continue;
        return createCapabilityResult({
          status: timedOut ? 'timeout' : 'failed',
          capability: capability.name,
          error: errorRecord(error, timedOut ? 'capability-timeout' : 'capability-failed'),
          durationMs,
          attempts,
          fallbackUsed: fallbackFrom ? capability.name : null,
          traceContext: actionRequest.traceContext
        });
      }
    }
    throw new Error('unreachable capability execution state');
  }

  return Object.freeze({
    async execute({ actionRequest, gateDecision }) {
      if (gateDecision?.outcome !== 'allow' || gateDecision.authorized !== true) {
        throw new TypeError('Capability execution requires an allowed GateDecision');
      }
      const candidates = registry.discover(actionRequest);
      if (candidates.length === 0) {
        return createCapabilityResult({
          status: 'unavailable', capability: actionRequest.capability,
          error: { code: 'capability-unavailable', message: 'No matching capability is registered', retryable: false },
          traceContext: actionRequest.traceContext
        });
      }

      const primary = candidates.map((entry) => entry.capability).find((capability) => declaredRequirementsCovered(capability, actionRequest));
      if (!primary) {
        return createCapabilityResult({
          status: 'unavailable', capability: actionRequest.capability,
          error: { code: 'capability-requirements-not-authorized', message: 'Capability requirements were not covered by Action Gate', retryable: false },
          traceContext: actionRequest.traceContext
        });
      }
      const attempts = [];
      let result = await run(primary, actionRequest, gateDecision, null, attempts);
      if (result.status === 'success' || result.status === 'partial') return result;

      for (const fallbackName of primary.fallbackCapabilities) {
        const fallback = registry.get(fallbackName);
        if (!fallback) continue;
        if (!fallback.actionClasses.includes(actionRequest.actionClass)) continue;
        if (!declaredRequirementsCovered(fallback, actionRequest)) continue;
        result = await run(fallback, actionRequest, gateDecision, primary.name, attempts);
        if (result.status === 'success' || result.status === 'partial') return result;
      }
      return result;
    }
  });
}
