import { parseRecurrenceRule } from './recurrenceEngine.js';
import { resolveElapsedInterval } from './elapsedInterval.js';

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
  if (typeof temporalService.now !== 'function') {
    throw temporalError('task-time-context-unavailable', 'Temporal Context cannot resolve fixed interval recurrence');
  }
  const reference = temporalService.now();
  const firstInstant = new Date(reference.getTime() + unitMs * rule.interval);
  return Object.freeze({
    status: 'resolved',
    originalExpression: null,
    referenceInstant: reference.toISOString(),
    timeZone: 'UTC',
    localStart: utcLocalDateTime(firstInstant),
    utcStart: firstInstant.toISOString(),
    utcEndExclusive: null,
    precision: rule.freq === 'MINUTELY' ? 'minute' : 'hour',
    ambiguous: false,
    source: 'deterministic-fixed-interval-recurrence'
  });
}

async function cancelLinkedRecurringSchedule({ recurringScheduler, scope, taskId }) {
  if (!recurringScheduler) return null;
  if (typeof recurringScheduler.cancelByTaskId === 'function') {
    return recurringScheduler.cancelByTaskId({ scope, taskId });
  }
  if (!recurringScheduler.list || !recurringScheduler.cancel) return null;
  const schedules = await recurringScheduler.list({ scope, limit: 100 });
  const linked = schedules.find((schedule) => schedule.taskId === taskId && ['active', 'paused', 'error'].includes(schedule.status));
  if (!linked) return null;
  return recurringScheduler.cancel({ scope, scheduleId: linked.scheduleId });
}

export function createTemporalTaskStore({ taskStore, temporalService, recurringScheduler = null } = {}) {
  if (!taskStore?.create || !taskStore?.list || !taskStore?.get || !taskStore?.cancel) throw new TypeError('taskStore is required');
  if (!temporalService?.resolveForUser) throw new TypeError('temporalService is required');

  return Object.freeze({
    async create({ scope, input = {} }) {
      let expression = input.temporalExpression ?? input.when ?? (typeof input.runAt === 'string' && !isExactIsoInstant(input.runAt) ? input.runAt : null);
      let resolution = null;
      if (!expression && input.recurrence && input.localTime) {
        expression = await expressionFromLocalTime({ temporalService, userScope: scope.userScope, localTime: input.localTime });
      }
      if (!expression && input.recurrence) {
        resolution = fixedIntervalResolution({ temporalService, recurrence: input.recurrence });
      }
      if (!expression && !resolution) {
        if (input.recurrence) throw temporalError('recurrence-start-required', 'A calendar recurring task requires localTime or an explicit first local time');
        return normalizeTask(await taskStore.create({ scope, input }));
      }

      if (!resolution && expression && typeof temporalService.now === 'function') {
        resolution = resolveElapsedInterval(expression, { referenceInstant: temporalService.now() });
      }
      if (!resolution) resolution = await temporalService.resolveForUser(scope.userScope, expression);
      if (resolution.status === 'timezone-required') throw temporalError('task-timezone-required', 'User timezone is required to schedule relative local time');
      if (resolution.status !== 'resolved') throw temporalError('task-time-unresolved', 'Temporal expression could not be resolved deterministically');
      if (resolution.ambiguous || !resolution.utcStart || resolution.utcEndExclusive) throw temporalError('task-time-ambiguous', 'Task time is a range or ambiguous; a precise time is required');

      const payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? { ...input.payload } : { ...input };
      payload.temporal = Object.freeze({
        originalExpression: resolution.originalExpression,
        timeZone: resolution.timeZone,
        localDateTime: resolution.localStart,
        utcInstant: resolution.utcStart,
        precision: resolution.precision
      });

      const created = normalizeTask(await taskStore.create({
        scope,
        input: { ...input, runAt: resolution.utcStart, temporalExpression: expression, payload }
      }));

      if (!input.recurrence) return created;
      if (!recurringScheduler?.register) throw temporalError('recurrence-unavailable', 'Recurring scheduler is not available in this runtime');
      const notificationMessage = typeof payload.message === 'string' && payload.message.trim() !== '' ? payload.message.trim() : null;
      const schedule = await recurringScheduler.register({
        scheduleId: input.scheduleId,
        taskId: created.taskId,
        recurrence: input.recurrence,
        timeZone: resolution.timeZone,
        dtstartLocal: resolution.localStart,
        misfirePolicy: input.misfirePolicy ?? 'fire_once',
        maxCatchup: input.maxCatchup ?? 10,
        state: { originalExpression: resolution.originalExpression, localTime: input.localTime ?? null, notificationMessage, createdBy: scope.userScope }
      });
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
}
