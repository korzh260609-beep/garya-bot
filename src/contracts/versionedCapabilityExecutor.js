function requireMethod(value, method, name) {
  if (!value || typeof value[method] !== 'function') throw new TypeError(`${name}.${method} is required`);
}

function declaredVersion(payload) {
  const value = payload?.contractVersion ?? payload?.version;
  return typeof value === 'string' && /^\d+\.\d+$/.test(value.trim()) ? value.trim() : '1.0';
}

function versionedRecord(actionRequest, payload) {
  return Object.freeze({
    version: declaredVersion(payload),
    globalUserId: actionRequest.actor.globalUserId,
    projectScope: actionRequest.scope.projectScope,
    scope: Object.freeze({
      userScope: actionRequest.scope.userScope,
      projectScope: actionRequest.scope.projectScope,
      groupScope: actionRequest.scope.groupScope ?? null,
      threadScope: actionRequest.scope.threadScope ?? null
    }),
    payload
  });
}

export function createVersionedCapabilityExecutor({ executor, contractVersioning } = {}) {
  requireMethod(executor, 'execute', 'executor');
  requireMethod(contractVersioning, 'resolve', 'contractVersioning');

  return Object.freeze({
    async execute(input) {
      const actionRequest = input?.actionRequest;
      if (!actionRequest?.actor || !actionRequest?.scope) return executor.execute(input);
      await contractVersioning.resolve('capability-input', versionedRecord(actionRequest, actionRequest.payload), {
        traceContext: input.traceContext ?? actionRequest.traceContext,
        source: 'production-capability-input'
      });
      const result = await executor.execute(input);
      await contractVersioning.resolve('capability-result', versionedRecord(actionRequest, result), {
        traceContext: input.traceContext ?? actionRequest.traceContext,
        source: 'production-capability-result'
      });
      return result;
    }
  });
}
