function isExactIsoInstant(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())) return false;
  return Number.isFinite(Date.parse(value));
}

function temporalError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  return error;
}

export function createTemporalTaskStore({ taskStore, temporalService } = {}) {
  if (!taskStore?.create || !taskStore?.list || !taskStore?.get || !taskStore?.cancel) throw new TypeError('taskStore is required');
  if (!temporalService?.resolveForUser) throw new TypeError('temporalService is required');

  return Object.freeze({
    async create({ scope, input = {} }) {
      const expression = input.temporalExpression ?? input.when ?? (typeof input.runAt === 'string' && !isExactIsoInstant(input.runAt) ? input.runAt : null);
      if (!expression) return taskStore.create({ scope, input });

      const resolution = await temporalService.resolveForUser(scope.userScope, expression);
      if (resolution.status === 'timezone-required') {
        throw temporalError('task-timezone-required', 'User timezone is required to schedule relative local time');
      }
      if (resolution.status !== 'resolved') {
        throw temporalError('task-time-unresolved', 'Temporal expression could not be resolved deterministically');
      }
      if (resolution.ambiguous || !resolution.utcStart || resolution.utcEndExclusive) {
        throw temporalError('task-time-ambiguous', 'Task time is a range or ambiguous; a precise time is required');
      }

      const payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
        ? { ...input.payload }
        : { ...input };
      payload.temporal = Object.freeze({
        originalExpression: resolution.originalExpression,
        timeZone: resolution.timeZone,
        localDateTime: resolution.localStart,
        utcInstant: resolution.utcStart,
        precision: resolution.precision
      });

      return taskStore.create({
        scope,
        input: { ...input, runAt: resolution.utcStart, temporalExpression: expression, payload }
      });
    },
    list: (request) => taskStore.list(request),
    get: (request) => taskStore.get(request),
    cancel: (request) => taskStore.cancel(request)
  });
}
