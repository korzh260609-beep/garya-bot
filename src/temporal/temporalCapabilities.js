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

function publicScheduleChoices(schedules, locale) {
  const copy = scheduleCopy(locale);
  return Object.freeze(schedules.map((schedule, index) => Object.freeze({
    position: index + 1,
    title: scheduleTitle(schedule, copy),
    status: copy.statuses[schedule.status] ?? schedule.status,
    schedule: recurrenceText(schedule.recurrence, locale),
    localTime: scheduleLocalTime(schedule),
    timeZone: timeZoneText(schedule.timeZone, locale)
  })));
}

function scheduleSelectionError(code, message, schedules = [], locale = 'en') {
  return Object.freeze({
    status: 'failed',
    error: { code, message, retryable: false },
    data: {
      candidateCount: schedules.length,
      schedules: publicScheduleChoices(schedules, locale),
      message: schedules.length > 0 ? scheduleListMessage(schedules, { locale }) : message
    }
  });
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
  const position = raw.position == null ? null : Number(raw.position);
  if (position != null && (!Number.isInteger(position) || position < 1 || position > 100)) {
    throw new TypeError('input.selector.position must be an integer from 1 to 100');
  }
  if (!recurrence && !notificationMessage && !localTime && position == null) return null;
  return Object.freeze({ recurrence, notificationMessage, localTime, position });
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
    if (selector.position != null) {
      candidates = candidates[selector.position - 1] ? [candidates[selector.position - 1]] : [];
      selectedBy = `${selectedBy}-position`;
    }
  }
  if (candidates.length === 1) return Object.freeze({ scheduleId: candidates[0].scheduleId, inferred: true, selectedBy });
  if (candidates.length === 0) return Object.freeze({ error: scheduleSelectionError('schedule-not-found', 'No matching recurring schedule exists in the current scope.', [], request.input?.locale) });
  return Object.freeze({ error: scheduleSelectionError('schedule-selection-required', 'Multiple recurring schedules match the requested automation. Clarification is required to avoid guessing.', candidates, request.input?.locale) });
}

function dtstartAtLocalTime(dtstartLocal, localTime) {
  const date = String(dtstartLocal ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('Existing schedule start is invalid');
  return `${date}T${localTime}:00`;
}

const SCHEDULE_STATUSES = Object.freeze(['active', 'paused', 'cancelled', 'error']);

function scheduleLanguage(locale) {
  const value = String(locale ?? 'en').toLowerCase();
  if (value.startsWith('uk')) return 'uk';
  if (value.startsWith('ru')) return 'ru';
  return 'en';
}

function scheduleCopy(locale) {
  const language = scheduleLanguage(locale);
  if (language === 'uk') {
    return Object.freeze({
      locale: 'uk-UA',
      heading: (count, activeOnly) => activeOnly ? `Активні автоматизації: ${count}` : `Ваші автоматизації: ${count}`,
      empty: (activeOnly) => activeOnly ? 'Активних автоматизацій немає.' : 'Автоматизацій немає.',
      untitled: 'Автоматизація без зазначеного повідомлення',
      at: 'о',
      status: 'Статус',
      schedule: 'Розклад',
      timezone: 'Часовий пояс',
      next: 'Наступний запуск',
      noNext: 'не заплановано',
      statuses: { active: 'активна', paused: 'призупинена', cancelled: 'скасована', error: 'помилка' }
    });
  }
  if (language === 'ru') {
    return Object.freeze({
      locale: 'ru-RU',
      heading: (count, activeOnly) => activeOnly ? `Активные автоматизации: ${count}` : `Ваши автоматизации: ${count}`,
      empty: (activeOnly) => activeOnly ? 'Активных автоматизаций нет.' : 'Автоматизаций нет.',
      untitled: 'Автоматизация без указанного сообщения',
      at: 'в',
      status: 'Статус',
      schedule: 'Расписание',
      timezone: 'Часовой пояс',
      next: 'Следующий запуск',
      noNext: 'не запланирован',
      statuses: { active: 'активна', paused: 'приостановлена', cancelled: 'отменена', error: 'ошибка' }
    });
  }
  return Object.freeze({
    locale: 'en-GB',
    heading: (count, activeOnly) => activeOnly ? `Active automations: ${count}` : `Your automations: ${count}`,
    empty: (activeOnly) => activeOnly ? 'There are no active automations.' : 'There are no automations.',
    untitled: 'Automation without a specified message',
    at: 'at',
    status: 'Status',
    schedule: 'Schedule',
    timezone: 'Time zone',
    next: 'Next run',
    noNext: 'not scheduled',
    statuses: { active: 'active', paused: 'paused', cancelled: 'cancelled', error: 'error' }
  });
}

function scheduleStatuses(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('input.statuses must be a non-empty array');
  const statuses = value.map((item) => String(item).trim().toLowerCase());
  if (statuses.some((status) => !SCHEDULE_STATUSES.includes(status))) throw new TypeError('input.statuses contains an unsupported schedule status');
  return Object.freeze([...new Set(statuses)]);
}

function scheduleTitle(schedule, copy) {
  const raw = schedule.state?.notificationMessage ?? schedule.notificationMessage;
  const normalized = typeof raw === 'string' ? raw.replace(/\s+/gu, ' ').trim() : '';
  if (!normalized) return copy.untitled;
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}…`;
}

function recurrenceParts(value) {
  return Object.fromEntries(String(value ?? '').split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return [];
    return [[part.slice(0, separator).toUpperCase(), part.slice(separator + 1)]];
  }));
}

function recurrenceText(value, locale) {
  const language = scheduleLanguage(locale);
  const parts = recurrenceParts(value);
  const interval = Number(parts.INTERVAL ?? 1);
  const every = Number.isInteger(interval) && interval > 1 ? interval : 1;
  const weekdays = {
    en: { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' },
    ru: { MO: 'пн', TU: 'вт', WE: 'ср', TH: 'чт', FR: 'пт', SA: 'сб', SU: 'вс' },
    uk: { MO: 'пн', TU: 'вт', WE: 'ср', TH: 'чт', FR: 'пт', SA: 'сб', SU: 'нд' }
  };
  const days = String(parts.BYDAY ?? '').split(',').filter(Boolean).map((day) => weekdays[language][day] ?? day).join(', ');

  if (language === 'ru') {
    if (parts.FREQ === 'MINUTELY') return every === 1 ? 'каждую минуту' : `каждые ${every} мин.`;
    if (parts.FREQ === 'HOURLY') return every === 1 ? 'каждый час' : `каждые ${every} ч.`;
    if (parts.FREQ === 'DAILY') return every === 1 ? 'каждый день' : `каждые ${every} дн.`;
    if (parts.FREQ === 'WEEKLY') return `${every === 1 ? 'каждую неделю' : `каждые ${every} нед.`}${days ? ` (${days})` : ''}`;
    if (parts.FREQ === 'MONTHLY') return every === 1 ? 'каждый месяц' : `каждые ${every} мес.`;
    if (parts.FREQ === 'YEARLY') return every === 1 ? 'каждый год' : `каждые ${every} г.`;
    return 'повторяющееся';
  }
  if (language === 'uk') {
    if (parts.FREQ === 'MINUTELY') return every === 1 ? 'щохвилини' : `кожні ${every} хв.`;
    if (parts.FREQ === 'HOURLY') return every === 1 ? 'щогодини' : `кожні ${every} год.`;
    if (parts.FREQ === 'DAILY') return every === 1 ? 'щодня' : `кожні ${every} дн.`;
    if (parts.FREQ === 'WEEKLY') return `${every === 1 ? 'щотижня' : `кожні ${every} тиж.`}${days ? ` (${days})` : ''}`;
    if (parts.FREQ === 'MONTHLY') return every === 1 ? 'щомісяця' : `кожні ${every} міс.`;
    if (parts.FREQ === 'YEARLY') return every === 1 ? 'щороку' : `кожні ${every} р.`;
    return 'повторювана';
  }
  if (parts.FREQ === 'MINUTELY') return every === 1 ? 'every minute' : `every ${every} minutes`;
  if (parts.FREQ === 'HOURLY') return every === 1 ? 'every hour' : `every ${every} hours`;
  if (parts.FREQ === 'DAILY') return every === 1 ? 'every day' : `every ${every} days`;
  if (parts.FREQ === 'WEEKLY') return `${every === 1 ? 'every week' : `every ${every} weeks`}${days ? ` (${days})` : ''}`;
  if (parts.FREQ === 'MONTHLY') return every === 1 ? 'every month' : `every ${every} months`;
  if (parts.FREQ === 'YEARLY') return every === 1 ? 'every year' : `every ${every} years`;
  return 'recurring';
}

function timeZoneText(value, locale) {
  const zone = String(value ?? '').trim();
  if (!zone) return scheduleLanguage(locale) === 'ru' ? 'не указан' : scheduleLanguage(locale) === 'uk' ? 'не вказаний' : 'not specified';
  if (zone === 'UTC') return 'UTC';
  const city = zone.split('/').at(-1).replaceAll('_', ' ');
  if (city === 'Kyiv') return scheduleLanguage(locale) === 'ru' ? 'Киев' : scheduleLanguage(locale) === 'uk' ? 'Київ' : 'Kyiv';
  return city;
}

function nextOccurrenceText(value, timeZone, copy) {
  if (value == null) return copy.noNext;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return copy.noNext;
  try {
    return new Intl.DateTimeFormat(copy.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || 'UTC'
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(copy.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    }).format(date);
  }
}

function scheduleListMessage(schedules, { locale = 'en', statuses = null } = {}) {
  const copy = scheduleCopy(locale);
  const activeOnly = statuses?.length === 1 && statuses[0] === 'active';
  if (schedules.length === 0) return copy.empty(activeOnly);
  const lines = schedules.map((schedule, index) => {
    const storedLocalTime = schedule.state?.localTime ?? String(schedule.dtstartLocal ?? '').slice(11, 16);
    const cadence = recurrenceText(schedule.recurrence, locale);
    const when = storedLocalTime ? `${cadence} ${copy.at} ${storedLocalTime}` : cadence;
    return [
      `${index + 1}. «${scheduleTitle(schedule, copy)}»`,
      `   ${copy.status}: ${copy.statuses[schedule.status] ?? schedule.status}`,
      `   ${copy.schedule}: ${when}`,
      `   ${copy.timezone}: ${timeZoneText(schedule.timeZone, locale)}`,
      `   ${copy.next}: ${nextOccurrenceText(schedule.nextOccurrenceAt, schedule.timeZone, copy)}`
    ].join('\n');
  });
  return `${copy.heading(schedules.length, activeOnly)}\n\n${lines.join('\n\n')}`;
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
          const statuses = scheduleStatuses(request.input?.statuses);
          const visibleSchedules = statuses ? schedules.filter((schedule) => statuses.includes(schedule.status)) : schedules;
          return {
            status: 'success',
            data: {
              schedules: visibleSchedules,
              message: scheduleListMessage(visibleSchedules, { locale: request.input?.locale, statuses })
            }
          };
        }
      }),
      capability({
        name: 'schedule-status', description: 'Read one recurring schedule in the current scope.',
        actionTypes: ['schedule-status'], actionClasses: ['read-only'],
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request });
          if (target.error) return target.error;
          const schedule = await recurringScheduler.get({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: scheduleListMessage([schedule], { locale: request.input?.locale }) } } : { status: 'failed', error: { code: 'schedule-not-found', message: 'Schedule not found in scope', retryable: false } };
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
            ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: scheduleListMessage([schedule], { locale: request.input?.locale }) } }
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
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: scheduleListMessage([schedule], { locale: request.input?.locale }) } } : { status: 'failed', error: { code: 'schedule-not-active', message: 'Active schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-resume', description: 'Resume a paused recurring schedule in the current scope.',
        actionTypes: ['schedule-resume'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request, statuses: ['paused'] });
          if (target.error) return target.error;
          const schedule = await recurringScheduler.resume({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: scheduleListMessage([schedule], { locale: request.input?.locale }) } } : { status: 'failed', error: { code: 'schedule-not-paused', message: 'Paused schedule not found in scope', retryable: false } };
        }
      }),
      capability({
        name: 'schedule-cancel', description: 'Cancel a recurring schedule in the current scope.',
        actionTypes: ['schedule-cancel'], actionClasses: ['state-changing'], confirmationRequired: true,
        execute: async (request) => {
          const target = await resolveScheduleTarget({ recurringScheduler, request, statuses: ['active', 'paused', 'error'] });
          if (target.error) return target.error;
          const schedule = await recurringScheduler.cancel({ scope: scopeFrom(request), scheduleId: target.scheduleId });
          return schedule ? { status: 'success', data: { schedule, inferredScheduleId: target.inferred, selectedBy: target.selectedBy, message: scheduleListMessage([schedule], { locale: request.input?.locale }) } } : { status: 'failed', error: { code: 'schedule-not-cancellable', message: 'Cancellable schedule not found in scope', retryable: false } };
        }
      })
    );
  }

  return Object.freeze(result);
}
