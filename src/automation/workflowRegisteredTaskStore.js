import { createWorkflowDefinition } from './workflowContract.js';
import { createStructuredAutomationPlan, workflowStepsForStructuredPlan } from './structuredAutomationPlan.js';

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function timestamp(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${field} must be a valid timestamp`);
  return date.toISOString();
}

function workflowForCreatedTask({ task, scope, input }) {
  if (input?.kind === 'structured-automation') {
    const payload = input.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('structured automation payload is required');
    const plan = createStructuredAutomationPlan(payload.plan);
    const schedule = task.recurringSchedule;
    if (!schedule) throw new TypeError('structured automation requires a recurring schedule');
    const automationId = requiredString(task.taskId, 'task.taskId');
    const globalUserId = requiredString(scope.userScope ?? scope.globalUserId, 'scope.userScope');
    const createdAt = timestamp(task.createdAt ?? new Date(), 'task.createdAt');
    return createWorkflowDefinition({
      automationId,
      version: 1,
      trigger: { type: 'recurring', recurrence: { rule: requiredString(schedule.recurrence, 'schedule.recurrence'), timeZone: requiredString(schedule.timeZone, 'schedule.timeZone'), dtstartLocal: requiredString(schedule.dtstartLocal, 'schedule.dtstartLocal') } },
      steps: workflowStepsForStructuredPlan(plan),
      inputs: { plan },
      delivery: payload.delivery ?? {},
      executionPolicy: { maxAttempts: Number.isInteger(input.maxAttempts) ? input.maxAttempts : 3, protectedAction: true, confirmationRequired: false },
      scope: { globalUserId, projectScope: requiredString(scope.projectScope, 'scope.projectScope'), groupScope: scope.groupScope ?? null, threadScope: scope.threadScope ?? null },
      createdBy: globalUserId,
      updatedBy: globalUserId,
      createdAt,
      updatedAt: timestamp(task.updatedAt ?? createdAt, 'task.updatedAt'),
      provenance: { source: 'canonical-structured-plan', capability: 'task-create', legacyTaskId: automationId, traceContext: payload.traceContext ?? {}, sourceText: payload.automation?.sourceText ?? null }
    });
  }
  if (input?.kind !== 'self-notification') return null;
  const payload = input.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('self-notification payload is required');
  const schedule = task.recurringSchedule ?? null;
  const automationId = requiredString(task.taskId, 'task.taskId');
  const globalUserId = requiredString(scope.userScope ?? scope.globalUserId, 'scope.userScope');
  const createdAt = timestamp(task.createdAt ?? new Date(), 'task.createdAt');
  const updatedAt = timestamp(task.updatedAt ?? createdAt, 'task.updatedAt');
  const trigger = schedule
    ? {
        type: 'recurring',
        recurrence: {
          rule: requiredString(schedule.recurrence, 'schedule.recurrence'),
          timeZone: requiredString(schedule.timeZone, 'schedule.timeZone'),
          dtstartLocal: requiredString(schedule.dtstartLocal, 'schedule.dtstartLocal')
        }
      }
    : {
        type: 'one-shot',
        runAt: timestamp(task.runAt ?? task.availableAt, 'task.runAt')
      };

  return createWorkflowDefinition({
    automationId,
    version: 1,
    trigger,
    steps: [
      { type: 'compose', mode: 'static-message', input: 'message' },
      { type: 'deliver', mode: 'legacy-self-notification' }
    ],
    inputs: { message: requiredString(payload.message, 'payload.message') },
    delivery: payload.delivery ?? {},
    executionPolicy: {
      maxAttempts: Number.isInteger(input.maxAttempts) ? input.maxAttempts : 3,
      protectedAction: input.protectedAction === true,
      confirmationRequired: input.approvalRequired === true
    },
    scope: {
      globalUserId,
      projectScope: requiredString(scope.projectScope, 'scope.projectScope'),
      groupScope: scope.groupScope ?? null,
      threadScope: scope.threadScope ?? null
    },
    createdBy: globalUserId,
    updatedBy: globalUserId,
    createdAt,
    updatedAt,
    provenance: {
      source: payload.automation?.source ?? 'canonical-task-create',
      capability: payload.automation?.capability ?? 'task-create',
      legacyTaskId: automationId,
      traceContext: payload.traceContext ?? {}
    }
  });
}

export function createWorkflowRegisteredTaskStore({ taskStore, workflowStore } = {}) {
  if (!taskStore?.create || !taskStore?.list || !taskStore?.get || !taskStore?.cancel) throw new TypeError('taskStore is required');
  if (typeof workflowStore?.register !== 'function') throw new TypeError('workflowStore.register is required');

  return Object.freeze({
    async create(request) {
      const task = await taskStore.create(request);
      const workflow = workflowForCreatedTask({ task, scope: request.scope, input: request.input });
      if (!workflow) return task;
      await workflowStore.register({
        workflow,
        taskId: task.taskId,
        scheduleId: task.recurringSchedule?.scheduleId ?? null
      });
      return task;
    },
    list: (request) => taskStore.list(request),
    get: (request) => taskStore.get(request),
    cancel: (request) => taskStore.cancel(request)
  });
}
