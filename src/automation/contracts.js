function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

export const TASK_STATUSES = Object.freeze(['scheduled', 'queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled', 'dead_letter']);

export function createAutomationTask(input) {
  object(input, 'task');
  const status = input.status ?? 'queued';
  if (!TASK_STATUSES.includes(status)) throw new TypeError(`unsupported task status: ${status}`);
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new TypeError('maxAttempts must be a positive integer');
  return Object.freeze({
    id: requiredString(input.id, 'task.id'),
    kind: requiredString(input.kind, 'task.kind'),
    payload: Object.freeze({ ...object(input.payload ?? {}, 'task.payload') }),
    identityContext: Object.freeze({ ...object(input.identityContext, 'task.identityContext') }),
    scopeContext: Object.freeze({ ...object(input.scopeContext, 'task.scopeContext') }),
    traceContext: Object.freeze({ ...object(input.traceContext, 'task.traceContext') }),
    protectedAction: input.protectedAction === true,
    confirmationRequired: input.confirmationRequired === true,
    runAt: input.runAt == null ? null : requiredString(input.runAt, 'task.runAt'),
    status,
    attempt: input.attempt ?? 0,
    maxAttempts,
    createdAt: requiredString(input.createdAt, 'task.createdAt'),
    updatedAt: requiredString(input.updatedAt ?? input.createdAt, 'task.updatedAt'),
    lastError: input.lastError ?? null,
    result: input.result ?? null
  });
}

export function createDelegatedAgent(input) {
  object(input, 'agent');
  return Object.freeze({
    id: requiredString(input.id, 'agent.id'),
    name: requiredString(input.name, 'agent.name'),
    capabilities: Object.freeze([...(input.capabilities ?? [])].map((value) => requiredString(value, 'agent.capability'))),
    replaceable: true,
    identityMode: 'delegated-component'
  });
}

export function createAutomationEvent(type, task, details, at) {
  return Object.freeze({ type: requiredString(type, 'event.type'), taskId: task.id, status: task.status, at, details: details ?? null });
}
