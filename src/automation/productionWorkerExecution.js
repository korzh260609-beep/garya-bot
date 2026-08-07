function taskKind(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('task kind is required');
  return value.trim();
}

export function createProductionWorkerActionGate({ verifyMode = false } = {}) {
  return async function productionWorkerActionGate(request) {
    if (verifyMode) return Object.freeze({ outcome: 'allow', allowed: true, reason: 'worker-verification' });
    return Object.freeze({
      outcome: 'deny',
      allowed: false,
      reason: `Protected automated execution is not registered for task kind: ${taskKind(request?.kind)}`
    });
  };
}

export function createProductionWorkerExecutor({ verifyMode = false } = {}) {
  return async function productionWorkerExecutor({ taskId, kind, payload, attempt } = {}) {
    const normalizedKind = taskKind(kind);
    if (verifyMode) return Object.freeze({ verified: true, taskId, kind: normalizedKind, attempt, payload });

    if (normalizedKind === 'user-task') {
      return Object.freeze({
        status: 'completed',
        taskId,
        kind: normalizedKind,
        attempt,
        acknowledged: true
      });
    }

    const error = new Error(`No production executor registered for task kind: ${normalizedKind}`);
    error.code = 'unsupported-production-task-kind';
    throw error;
  };
}
