import { createCapability } from '../contracts/capability.js';
import { parseRecurrenceRule } from './recurrenceEngine.js';

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

function providedScheduleId(request) {
  const value = request.input?.scheduleId;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function scheduleSelectionError(code, message, schedules = []) {
  return Object.freeze({ status: 'failed', error: { code, message, retryable: false }, data: { schedules } });
}

function normalizedLocalTime(value) {
  if (value == null) return null;
  const match = String(value).trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) throw new TypeError('input.localTime must be HH:MM');
  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new TypeError('input.localTime must be HH:MM');
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function normalizedSemanticText(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().toLocaleLowerCase('und') : null;
}

function normalizedRecurrence(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return parseRecurrenceRule(value.trim()).canonical;
}

function semanticScheduleSelector(request) {
  const raw = request.input?.selector;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const recurrence = normalizedRecurrence(raw.recurrence);
  const notificationMessage = normalizedSemanticText(raw.notificationMessage);
  const localTime = raw.localTime == null ? null : normalizedLocalTime(raw.localTime);
  if (!recurrence && !notificationMessage && !localTime) return null;
  return Object.freeze({ recurrence, notificationMessage, localTime });
}

function scheduleLocalTime(schedule) {
  const value = schedule.state?.localTime ?? String(schedule.dtstartLocal ?? '').slice(11, 16);
  return value ? normalizedLocalTime(value) : null;
}

function selectorMatchQuality(schedule, selector) {
  if (selector.recurrence && normalizedRecurrence(schedule.recurrence) !== selector.recurrence) return 'mismatch';
  if (selector.localTime && scheduleLocalTime(schedule) !== selector.localTime) return 'mismatch';
  if (selector.notificationMessage) {
    const storedMessage = normalizedSemanticText(schedule.state?.notificationMessage ?? schedule.notificationMessage);
    if (storedMessage && storedMessage !== selector.notificationMessage) return 'mismatch';
    if (!storedMessage) return 'compatible-legacy';
  }
  return 'exact';
}

async function resolveScheduleTarget({ recurringScheduler, request, statuses = null }) {
  const explicit = providedScheduleId(request);
  if (explicit) return Object.freeze({ scheduleId: explicit, inferred: false, selectedBy: 'schedule-id' });
  const schedules = await recurringScheduler.list({ scope: scopeFrom(request), limit: 100 });
  let candidates = Array.isArray(statuses) ? schedules.filter((item) => statuses.includes(item.status)) : schedules;
  const selector = semanticScheduleSelector(request);
  let selectedBy = selector ? 'semantic-selector' : 'single-schedule';
  if (selector) {
    const evaluated = candidates.map((schedule) => ({ schedule, quality: selectorMatchQuality(schedule, selector) }));
    const exact = evaluated.filter((item) => item.quality === 'exact').map((item) => item.schedule);
    if (exact.length > 0) {
      candidates = exact;
    } else {
      candidates = evaluated.filter((item) => item.quality === 'compatible-legacy').map((item) => item.schedule);
      selectedBy = 'semantic-selector-legacy-compatible';
    }
  }
  if (candidates.length === 1) return Object.freeze({ scheduleId: candidates[0].scheduleId, inferred: true, selectedBy });
  if (candidates.length === 0) return Object.freeze({ error: scheduleSelectionError('schedule-not-found', 'No matching recurring schedule exists in the current scope.') });
  return Object.freeze({ error: scheduleSelectionError('schedule-selection-required', 'Multiple recurring schedules match the requested automation. Clarification is required to avoid guessing.', candidates) });
}

function dtstartAtLocalTime(dtstartLocal, localTime) {
  const date = String(dtstartLocal ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('Existing schedule start is invalid');
  return `${date}T${localTime}:00`;
}

function scheduleListMessage(schedules) {
  if (schedules.length === 0) return 'Recurring schedules: 0';
  const lines = schedules.map((schedule, index) => {
    const storedLocalTime = schedule.state?.localTime ?? String(schedule.dtstartLocal ?? '').slice(11, 16);
    const localTime = storedLocalTime || 'time-unavailable';
    return `${index + 1}. ${schedule.scheduleId} | ${schedule.status} | ${schedule.recurrence} | ${localTime} (${schedule.timeZone ?? 'timezone-unavailable'}) | next: ${schedule.nextOccurrenceAt ?? 'none'}`;
  });
  return `Recurring schedules: ${schedules.length}\n${lines.join('\n')}`;
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
          return { status: 'success', data: { schedules, message: scheduleListMessage(schedules) } };
        }
      }),
      capability({
        name: 'schedule-status', description: 'Read one recurring schedule in the current scope.',
        actionTypes: ['schedule-status'], actionClasses: ['read-only'],
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request });
          if (target.error) return target.error;
          const schedule = await recurringScheduler.get({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: `Schedule ${target.scheduleId}: ${schedule.status}` } } : { status: 'failed', error: { code: 'schedule-not-found', message: 'Schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-update', description: 'Update an existing recurring schedule in the current scope without creating a duplicate schedule.',
        actionTypes: ['schedule-update'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request, statuses: ['active', 'paused', 'error'] });
          if (target.error) return target.error;
          const existing = await recurringScheduler.get({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          if (!existing) return { status: 'failed', error: { code: 'schedule-not-found', message: 'Schedule not found in scope', retryable: false } };
          const localTime = normalizedLocalTime(request.input?.localTime);
          const recurrence = request.input?.recurrence == null ? null : String(request.input.recurrence).trim();
          const timeZone = request.input?.timeZone == null ? null : String(request.input.timeZone).trim();
          if (!localTime && !recurrence && !timeZone) return { status: 'failed', error: { code: 'schedule-update-empty', message: 'At least one schedule field must change', retryable: false } };
          if (timeZone && !temporalService.isValidTimeZone(timeZone)) return { status: 'failed', error: { code: 'invalid-timezone', message: 'A valid IANA timezone is required', retryable: false } };
          const dtstartLocal = localTime ? dtstartAtLocalTime(existing.dtstartLocal, localTime) : null;
          const schedule = await recurringScheduler.update({
            scope: scopeFrom(request),
            scheduleId: target.scheduleId,
            recurrence: recurrence || null,
            timeZone: timeZone || null,
            dtstartLocal,
            state: localTime ? { localTime } : null
          });
          return schedule
            ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: `Schedule ${target.scheduleId}: updated. Next execution: ${schedule.nextOccurrenceAt ?? 'none'}` } }
            : { status: 'failed', error: { code: 'schedule-not-updatable', message: 'Schedule is not updatable in its current state', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-pause', description: 'Pause a recurring schedule in the current scope.',
        actionTypes: ['schedule-pause'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request, statuses: ['active'] });
          if (target.error) return target.error;
          const schedule = await recurringScheduler.pause({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: `Schedule ${target.scheduleId}: paused` } } : { status: 'failed', error: { code: 'schedule-not-active', message: 'Active schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-resume', description: 'Resume a paused recurring schedule in the current scope.',
        actionTypes: ['schedule-resume'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request, statuses: ['paused'] });
          if (target.error) return target.error;
          const schedule = await recurringScheduler.resume({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: `Schedule ${target.scheduleId}: active` } } : { status: 'failed', error: { code: 'schedule-not-paused', message: 'Paused schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-cancel', description: 'Cancel a recurring schedule in the current scope.',
        actionTypes: ['schedule-cancel'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request, statuses: ['active', 'paused', 'error'] });
          if (target.error) return target.error;
          const schedule = await recurringScheduler.cancel({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: `Schedule ${target.scheduleId}: cancelled` } } : { status: 'failed', error: { code: 'schedule-not-cancellable', message: 'Cancellable schedule not found in scope', retryable: false } };
        }
      })
    );
  }

  return Object.freeze(result);
}
