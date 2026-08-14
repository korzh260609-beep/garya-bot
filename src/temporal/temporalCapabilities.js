import { createCapability } from '../contracts/capability.js';

export const TEMPORAL_SAFE_CAPABILITY_NAMES = Object.freeze(['time-read', 'timezone-set', 'memory-time-read']);
export const RECURRING_CAPABILITY_NAMES = Object.freeze(['schedule-list', 'schedule-status', 'schedule-update', 'schedule-pause', 'schedule-resume', 'schedule-cancel']);
export const TEMPORAL_CAPABILITY_NAMES = Object.freeze([...TEMPORAL_SAFE_CAPABILITY_NAMES, ...RECURRING_CAPABILITY_NAMES]);

function capability(input) {
  return createCapability({
    version: '1.0.0', timeoutMs: 5000, maxRetries: 0, estimatedCostUsd: 0,
    requiredPermissions: [`capability:${input.name}`], requiredSources: [], requiredTools: [], fallbackCapabilities: [],
    ...input
  });
}

function scopeFrom(request) {
  return Object.freeze({
    userScope: request.scope.userScope,
    projectScope: request.scope.projectScope,
    groupScope: request.scope.groupScope ?? null,
    threadScope: request.scope.threadScope ?? null
  });
}

function scheduleIdFrom(request) {
  const value = request.input?.scheduleId;
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('input.scheduleId is required');
  return value.trim();
}

function normalizedLocalTime(value) {
  if (value == null) return null;
  const match = String(value).trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new TypeError('input.localTime must be HH:MM');
  return `${match[1]}:${match[2]}`;
}

function dtstartAtLocalTime(dtstartLocal, localTime) {
  const date = String(dtstartLocal ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('Existing schedule start is invalid');
  return `${date}T${localTime}:00`;
}

export function createTemporalCapabilities({ temporalService, memoryProvider = null, recurringScheduler = null } = {}) {
  if (!temporalService?.contextForUser || !temporalService?.setUserTimezone) throw new TypeError('temporalService is required');

  const result = [
    capability({
      name: 'time-read', description: 'Read current UTC and user-local time from deterministic Temporal Context.',
      actionTypes: ['time-read'], actionClasses: ['read-only'],
      execute: async (request) => {
        const context = await temporalService.contextForUser(request.actor.globalUserId);
        const mode = request.input?.mode ?? 'both';
        const message = mode === 'utc'
          ? `UTC time: ${context.utc}.`
          : context.timezoneKnown
            ? `UTC time: ${context.utc}. Local time: ${context.localDateTime} (${context.timeZone}).`
            : `UTC time: ${context.utc}. Your local timezone is not set yet.`;
        return { status: 'success', data: { context, message } };
      }
    }),
    capability({
      name: 'timezone-set', description: 'Set the current global user IANA timezone.',
      actionTypes: ['timezone-set'], actionClasses: ['state-changing'], confirmationRequired: false,
      execute: async (request) => {
        const timeZone = String(request.input?.timeZone ?? '').trim();
        if (!temporalService.isValidTimeZone(timeZone)) return { status: 'failed', error: { code: 'invalid-timezone', message: 'A valid IANA timezone is required', retryable: false } };
        const record = await temporalService.setUserTimezone(request.actor.globalUserId, timeZone, {
          source: 'user-explicit', provenance: { requestId: request.traceContext.requestId, capability: 'timezone-set' }
        });
        const context = await temporalService.contextForUser(request.actor.globalUserId);
        return { status: 'success', data: { setting: record, context, message: `Timezone set to ${timeZone}. Local time: ${context.localDateTime}.` } };
      }
    })
  ];

  if (memoryProvider?.query) {
    result.push(capability({
      name: 'memory-time-read', description: 'Read scoped memory records inside a deterministic Temporal Context range.',
      actionTypes: ['memory-time-read'], actionClasses: ['read-only', 'private-data'],
      execute: async (request) => {
        const temporalRange = request.input?.temporalRange ?? null;
        if (!temporalRange?.utcStart) return { status: 'failed', error: { code: 'temporal-range-required', message: 'A normalized temporal range is required', retryable: false } };
        const query = await memoryProvider.query({ scope: scopeFrom(request), layers: request.input?.layers ?? ['session', 'user-memory', 'project-memory'], keys: request.input?.keys ?? [], now: temporalService.now().toISOString(), temporalRange });
        return { status: 'success', data: { records: query.records, diagnostics: query.diagnostics, temporalRange, message: `Memory records in period: ${query.records.length}` } };
      }
    }));
  }

  if (recurringScheduler?.list && recurringScheduler?.get && recurringScheduler?.update && recurringScheduler?.pause && recurringScheduler?.resume && recurringScheduler?.cancel) {
    result.push(
      capability({
        name: 'schedule-list', description: 'List recurring schedules in the current identity/project/group/thread scope.',
        actionTypes: ['schedule-list'], actionClasses: ['read-only'],
        execute: async (request) => {
          const schedules = await recurringScheduler.list({ scope: scopeFrom(request), limit: request.input?.limit ?? 100 });
          return { status: 'success', data: { schedules, message: `Recurring schedules: ${schedules.length}` } };
        }
      }),
      capability({
        name: 'schedule-status', description: 'Read one recurring schedule in the current scope.',
        actionTypes: ['schedule-status'], actionClasses: ['read-only'],
        execute: async (request) => {
          const scheduleId = scheduleIdFrom(request);
          const schedule = await recurringScheduler.get({ scope: scopeFrom(request), scheduleId });
          return schedule ? { status: 'success', data: { schedule, message: `Schedule ${scheduleId}: ${schedule.status}` } } : { status: 'failed', error: { code: 'schedule-not-found', message: 'Schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-update', description: 'Update an existing recurring schedule in the current scope without creating a duplicate schedule.',
        actionTypes: ['schedule-update'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const scheduleId = scheduleIdFrom(request);
          const existing = await recurringScheduler.get({ scope: scopeFrom(request), scheduleId });
          if (!existing) return { status: 'failed', error: { code: 'schedule-not-found', message: 'Schedule not found in scope', retryable: false } };
          const localTime = normalizedLocalTime(request.input?.localTime);
          const recurrence = request.input?.recurrence == null ? null : String(request.input.recurrence).trim();
          const timeZone = request.input?.timeZone == null ? null : String(request.input.timeZone).trim();
          if (!localTime && !recurrence && !timeZone) return { status: 'failed', error: { code: 'schedule-update-empty', message: 'At least one schedule field must change', retryable: false } };
          if (timeZone && !temporalService.isValidTimeZone(timeZone)) return { status: 'failed', error: { code: 'invalid-timezone', message: 'A valid IANA timezone is required', retryable: false } };
          const dtstartLocal = localTime ? dtstartAtLocalTime(existing.dtstartLocal, localTime) : null;
          const schedule = await recurringScheduler.update({
            scope: scopeFrom(request),
            scheduleId,
            recurrence: recurrence || null,
            timeZone: timeZone || null,
            dtstartLocal,
            state: localTime ? { localTime } : null
          });
          return schedule
            ? { status: 'success', data: { schedule, message: `Schedule ${scheduleId}: updated. Next execution: ${schedule.nextOccurrenceAt ?? 'none'}` } }
            : { status: 'failed', error: { code: 'schedule-not-updatable', message: 'Schedule is not updatable in its current state', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-pause', description: 'Pause a recurring schedule in the current scope.',
        actionTypes: ['schedule-pause'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const scheduleId = scheduleIdFrom(request);
          const schedule = await recurringScheduler.pause({ scope: scopeFrom(request), scheduleId });
          return schedule ? { status: 'success', data: { schedule, message: `Schedule ${scheduleId}: paused` } } : { status: 'failed', error: { code: 'schedule-not-active', message: 'Active schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-resume', description: 'Resume a paused recurring schedule in the current scope.',
        actionTypes: ['schedule-resume'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const scheduleId = scheduleIdFrom(request);
          const schedule = await recurringScheduler.resume({ scope: scopeFrom(request), scheduleId });
          return schedule ? { status: 'success', data: { schedule, message: `Schedule ${scheduleId}: active` } } : { status: 'failed', error: { code: 'schedule-not-paused', message: 'Paused schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-cancel', description: 'Cancel a recurring schedule in the current scope.',
        actionTypes: ['schedule-cancel'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const scheduleId = scheduleIdFrom(request);
          const schedule = await recurringScheduler.cancel({ scope: scopeFrom(request), scheduleId });
          return schedule ? { status: 'success', data: { schedule, message: `Schedule ${scheduleId}: cancelled` } } : { status: 'failed', error: { code: 'schedule-not-cancellable', message: 'Cancellable schedule not found in scope', retryable: false } };
        }
      })
    );
  }

  return Object.freeze(result);
}
