function nonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function executorContract(executor, id) {
  if (!executor || typeof executor.assess !== 'function' || typeof executor.execute !== 'function') {
    throw new TypeError(`deterministic executor ${id} must expose assess and execute functions`);
  }
  return executor;
}

export function createDeterministicL0Gate({ executors = {}, telemetry = null } = {}) {
  const registry = new Map(Object.entries(executors).map(([id, executor]) => [
    nonEmptyString(id, 'deterministic executor id'), executorContract(executor, id)
  ]));

  return Object.freeze({
    async tryExecute(input) {
      const resolution = input?.deterministicExecution;
      if (!resolution) return Object.freeze({ handled: false, reason: 'no-resolved-deterministic-execution' });
      const executorId = nonEmptyString(resolution.executorId, 'deterministicExecution.executorId');
      const executor = registry.get(executorId);
      if (!executor) {
        telemetry?.record?.({
          type: 'ai.l0.rejected', traceId: input.traceContext?.traceId ?? null,
          requestId: input.traceContext?.requestId ?? null, executorId, reason: 'executor-not-registered'
        });
        return Object.freeze({ handled: false, reason: 'executor-not-registered' });
      }

      const assessment = await executor.assess(Object.freeze({ request: input, resolution }));
      if (assessment?.eligible !== true) {
        telemetry?.record?.({
          type: 'ai.l0.rejected', traceId: input.traceContext?.traceId ?? null,
          requestId: input.traceContext?.requestId ?? null, executorId,
          reason: String(assessment?.reason ?? 'executor-rejected')
        });
        return Object.freeze({ handled: false, reason: String(assessment?.reason ?? 'executor-rejected') });
      }

      const reason = nonEmptyString(assessment.reason, 'deterministic assessment reason');
      const output = await executor.execute(Object.freeze({ request: input, resolution, assessment }));
      if (!output || typeof output !== 'object' || Array.isArray(output)) throw new TypeError('deterministic executor output must be an object');
      const result = Object.freeze({
        handled: true,
        executionPath: 'deterministic',
        tier: 'L0',
        executorId,
        taskClass: input.routing?.taskClass ?? input.task,
        reason,
        traceId: nonEmptyString(input.traceContext?.traceId, 'traceContext.traceId'),
        requestId: nonEmptyString(input.traceContext?.requestId, 'traceContext.requestId'),
        provider: null,
        model: null,
        usage: Object.freeze({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
        costUsd: 0,
        fallbackUsed: false,
        output: Object.freeze({ ...output }),
        text: typeof output.text === 'string' && output.text.trim() ? output.text.trim() : null,
      });
      telemetry?.record?.({
        type: 'ai.l0.completed', traceId: result.traceId, requestId: result.requestId,
        executorId, taskClass: result.taskClass, tier: 'L0', reason
      });
      return result;
    }
  });
}
