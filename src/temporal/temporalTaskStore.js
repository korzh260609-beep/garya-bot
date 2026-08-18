import { parseRecurrenceRule } from './recurrenceEngine.js';
import { resolveElapsedInterval } from './elapsedInterval.js';
import { createPostgresWorkflowUpdateStore } from '../automation/postgresWorkflowUpdateStore.js';
import { createWorkflowUpdateCapability } from '../automation/workflowUpdate.js';
import { createWorkflowRegisteredTaskStore } from '../automation/workflowRegisteredTaskStore.js';
import { createWorkflowDefinition } from '../automation/workflowContract.js';

const SUB_DAILY_INTERVAL_MS = Object.freeze({ MINUTELY: 60_000, HOURLY: 3_600_000 });

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

function normalizeTask(task) {
  if (!task) return null;
  const wrapper = task.payload;
  if (wrapper?.temporalExpression && wrapper?.payload?.temporal) {
    return Object.freeze({
      ...task,
      payload: Object.freeze({ ...wrapper.payload }),
      runAt: wrapper.runAt ?? task.runAt ?? task.availableAt ?? null,
      temporalExpression: wrapper.temporalExpression
    });
  }
  return task;
}

function normalizeLocalTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function nextDate(date) {
  const [year, month, day] = String(date).split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

function utcLocalDateTime(instant) {
  return instant.toISOString().replace(/\.\d{3}Z$/, '');
}

async function expressionFromLocalTime({ temporalService, userScope, localTime }) {
  const normalized = normalizeLocalTime(localTime);
  if (!normalized) throw temporalError('task-local-time-invalid', 'Recurring localTime must be HH:MM');
  if (typeof temporalService.contextForUser !== 'function') throw temporalError('task-time-context-unavailable', 'Temporal Context cannot resolve recurring local time');
  const context = await temporalService.contextForUser(userScope);
  if (!context.timezoneKnown || !context.localDate || !context.localDateTime) throw temporalError('task-timezone-required', 'User timezone is required to schedule recurring local time');
  const currentClock = context.localDateTime.slice(11, 16);
  const date = currentClock < normalized ? context.localDate : nextDate(context.localDate);
  return `${date} at ${normalized}`;
}

function fixedIntervalResolution({ temporalService, recurrence }) {
  const rule = parseRecurrenceRule(recurrence);
  const unitMs = SUB_DAILY_INTERVAL_MS[rule.freq] ?? null;
  if (!unitMs) return null;
  if (typeof temporalService.now !== 'function') throw temporalError('task-time-context-unavailable', 'Temporal Context cannot resolve fixed interval recurrence');
  const reference = temporalService.now();
  const firstInstant = new Date(reference.getTime() + unitMs * rule.interval);
  return Object.freeze({ status: 'resolved', originalExpression: null, referenceInstant: reference.toISOString(), timeZone: 'UTC', localStart: utcLocalDateTime(firstInstant), utcStart: firstInstant.toISOString(), utcEndExclusive: null, precision: rule.freq === 'MINUTELY' ? 'minute' : 'hour', ambiguous: false, source: 'deterministic-fixed-interval-recurrence' });
}

async function cancelLinkedRecurringSchedule({ recurringScheduler, scope, taskId }) {
  if (!recurringScheduler) return null;
  if (typeof recurringScheduler.cancelByTaskId === 'function') return recurringScheduler.cancelByTaskId({ scope, taskId });
  if (!recurringScheduler.list || !recurringScheduler.cancel) return null;
  const schedules = await recurringScheduler.list({ scope, limit: 100 });
  const linked = schedules.find((schedule) => schedule.taskId === taskId && ['active', 'paused', 'error'].includes(schedule.status));
  return linked ? recurringScheduler.cancel({ scope, scheduleId: linked.scheduleId }) : null;
}

function productionWorkflowAuthorization() {
  return Object.freeze({
    async authorize(request) {
      const evidence = request?.actor?.automationUpdateGate;
      const actorId = request?.actor?.globalUserId;
      const scopeUserId = request?.scope?.globalUserId ?? request?.scope?.userScope;
      const allowed = evidence?.source === 'canonical-action-gate'
        && evidence.authorized === true
        && evidence.actorGlobalUserId === actorId
        && evidence.projectScope === request?.scope?.projectScope
        && scopeUserId === actorId;
      return Object.freeze({ allowed, reason: allowed ? 'canonical-action-gate-authorized' : 'canonical-action-gate-evidence-invalid', evidenceRefs: evidence?.requestId ? Object.freeze([`action-gate:${evidence.requestId}`]) : Object.freeze([]) });
    }
  });
}

function workflowSchedulerAdapter(scheduler) {
  const adapt = (input) => ({ ...input, scope: { ...input.scope, userScope: input.scope?.userScope ?? input.scope?.globalUserId } });
  return Object.freeze({
    list: (input) => scheduler.list(adapt(input)),
    update: (input) => scheduler.update(adapt(input)),
    pause: (input) => scheduler.pause(adapt(input)),
    resume: (input) => scheduler.resume(adapt(input)),
    cancel: (input) => scheduler.cancel(adapt(input))
  });
}

export function createTemporalTaskStore({ taskStore, temporalService, recurringScheduler = null } = {}) {
  if (!taskStore?.create || !taskStore?.list || !taskStore?.get || !taskStore?.cancel) throw new TypeError('taskStore is required');
  if (!temporalService?.resolveForUser) throw new TypeError('temporalService is required');

  const coreStore = Object.freeze({
    async create({ scope, input = {} }) {
      let expression = input.temporalExpression ?? input.when ?? (typeof input.runAt === 'string' && !isExactIsoInstant(input.runAt) ? input.runAt : null);
      let resolution = null;
      if (!expression && input.recurrence && input.localTime) expression = await expressionFromLocalTime({ temporalService, userScope: scope.userScope, localTime: input.localTime });
      if (!expression && input.recurrence) resolution = fixedIntervalResolution({ temporalService, recurrence: input.recurrence });
      if (!expression && !resolution) {
        if (input.recurrence) throw temporalError('recurrence-start-required', 'A calendar recurring task requires localTime or an explicit first local time');
        return normalizeTask(await taskStore.create({ scope, input }));
      }
      if (!resolution && expression && typeof temporalService.now === 'function') resolution = resolveElapsedInterval(expression, { referenceInstant: temporalService.now() });
      if (!resolution) resolution = await temporalService.resolveForUser(scope.userScope, expression);
      if (resolution.status === 'timezone-required') throw temporalError('task-timezone-required', 'User timezone is required to schedule relative local time');
      if (resolution.status !== 'resolved') throw temporalError('task-time-unresolved', 'Temporal expression could not be resolved deterministically');
      if (resolution.ambiguous || !resolution.utcStart || resolution.utcEndExclusive) throw temporalError('task-time-ambiguous', 'Task time is a range or ambiguous; a precise time is required');

      const payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? { ...input.payload } : { ...input };
      payload.temporal = Object.freeze({ originalExpression: resolution.originalExpression, timeZone: resolution.timeZone, localDateTime: resolution.localStart, utcInstant: resolution.utcStart, precision: resolution.precision });
      const created = normalizeTask(await taskStore.create({ scope, input: { ...input, runAt: resolution.utcStart, temporalExpression: expression, payload } }));
      if (!input.recurrence) return created;
      if (!recurringScheduler?.register) throw temporalError('recurrence-unavailable', 'Recurring scheduler is not available in this runtime');
      const notificationMessage = typeof payload.message === 'string' && payload.message.trim() !== '' ? payload.message.trim() : null;
      const schedule = await recurringScheduler.register({ scheduleId: input.scheduleId, taskId: created.taskId, recurrence: input.recurrence, timeZone: resolution.timeZone, dtstartLocal: resolution.localStart, misfirePolicy: input.misfirePolicy ?? 'fire_once', maxCatchup: input.maxCatchup ?? 10, state: { originalExpression: resolution.originalExpression, localTime: input.localTime ?? null, notificationMessage, createdBy: scope.userScope, workflowVersion: 1, automationId: created.taskId } });
      return Object.freeze({ ...created, runAt: schedule.firstOccurrenceAt ?? created.runAt ?? created.availableAt ?? null, recurringSchedule: schedule });
    },
    async list(request) { return Object.freeze((await taskStore.list(request)).map(normalizeTask)); },
    async get(request) { return normalizeTask(await taskStore.get(request)); },
    async cancel(request) {
      const schedule = await cancelLinkedRecurringSchedule({ recurringScheduler, scope: request.scope, taskId: request.taskId });
      const task = normalizeTask(await taskStore.cancel(request));
      if (!task) return null;
      return schedule ? Object.freeze({ ...task, recurringSchedule: schedule }) : task;
    }
  });

  if (!taskStore.database?.query || !taskStore.taskQueue || !recurringScheduler) return coreStore;
  const workflowStore = createPostgresWorkflowUpdateStore({ database: taskStore.database });
  const schedulerAdapter = workflowSchedulerAdapter(recurringScheduler);
  const baseWorkflowUpdateService = createWorkflowUpdateCapability({ store: workflowStore, authorization: productionWorkflowAuthorization(), recurringScheduler: schedulerAdapter, oneShotTaskQueue: taskStore.taskQueue });

  async function adoptLegacySchedules({ scope }) {
    const workflowScope = {
      globalUserId: scope.globalUserId ?? scope.userScope,
      projectScope: scope.projectScope,
      groupScope: scope.groupScope ?? null,
      threadScope: scope.threadScope ?? null
    };
    const schedulerScope = { ...workflowScope, userScope: workflowScope.globalUserId };
    const [registered, schedules] = await Promise.all([
      workflowStore.list({ scope: workflowScope, limit: 201 }),
      recurringScheduler.list({ scope: schedulerScope, limit: 100 })
    ]);
    const knownSchedules = new Set(registered.map((record) => record.scheduleId).filter(Boolean));
    let adopted = 0;
    for (const schedule of schedules) {
      if (knownSchedules.has(schedule.scheduleId) || !['active', 'paused', 'error'].includes(schedule.status)) continue;
      const task = await coreStore.get({ scope: schedulerScope, taskId: schedule.taskId });
      const message = schedule.state?.notificationMessage
        ?? task?.payload?.notificationMessage
        ?? task?.payload?.message
        ?? null;
      if (typeof message !== 'string' || message.trim() === '') continue;
      const createdAt = task?.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString();
      const workflow = createWorkflowDefinition({
        automationId: schedule.state?.automationId ?? schedule.taskId,
        version: Number.isInteger(schedule.state?.workflowVersion) && schedule.state.workflowVersion > 0 ? schedule.state.workflowVersion : 1,
        trigger: {
          type: 'recurring',
          recurrence: {
            rule: schedule.recurrence,
            timeZone: schedule.timeZone,
            dtstartLocal: schedule.dtstartLocal
          }
        },
        steps: [
          { type: 'compose', mode: 'static-message', input: 'message' },
          { type: 'deliver', mode: 'legacy-self-notification' }
        ],
        inputs: { message: message.trim() },
        delivery: task?.payload?.delivery ?? {},
        executionPolicy: { maxAttempts: task?.maxAttempts ?? 3, protectedAction: true, confirmationRequired: false },
        scope: workflowScope,
        createdBy: workflowScope.globalUserId,
        updatedBy: workflowScope.globalUserId,
        createdAt,
        updatedAt: createdAt,
        provenance: { source: 'legacy-schedule-adoption', legacyTaskId: schedule.taskId, legacyScheduleId: schedule.scheduleId }
      });
      await workflowStore.register({ workflow, taskId: schedule.taskId, scheduleId: schedule.scheduleId });
      adopted += 1;
    }
    return adopted;
  }

  const workflowUpdateService = Object.freeze({
    async update(request) {
      try {
        return await baseWorkflowUpdateService.update(request);
      } catch (error) {
        if (error?.code !== 'workflow_update_target_not_found') throw error;
        const adopted = await adoptLegacySchedules({ scope: request.scope });
        if (adopted === 0) throw error;
        return baseWorkflowUpdateService.update(request);
      }
    },
    history: (request) => baseWorkflowUpdateService.history(request)
  });
  const registeredStore = createWorkflowRegisteredTaskStore({ taskStore: coreStore, workflowStore });
  return Object.freeze({
    create: registeredStore.create,
    list: registeredStore.list,
    get: registeredStore.get,
    cancel: registeredStore.cancel,
    workflowStore,
    workflowUpdateService,
    async listWorkflows({ scope, limit = 100 }) {
      await adoptLegacySchedules({ scope });
      return workflowStore.list({ scope, limit });
    }
  });
}
