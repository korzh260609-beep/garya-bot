import { createTemporalService } from './temporalService.js';

function normalized(value) {
  return String(value ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/[!?;,()\[\]{}]/g, ' ').replace(/\s+/g, ' ');
}

function hasPhrase(text, phrase) {
  return ` ${normalized(text)} `.includes(` ${normalized(phrase)} `);
}

function firstMatch(text, groups) {
  for (const group of groups) {
    if (group.phrases.some((phrase) => hasPhrase(text, phrase))) return group;
  }
  return null;
}

const IMPLICIT_ALIASES = Object.freeze([
  { phrases: ['через минуту', 'за хвилину', 'in a minute', 'in one minute'], replacement: 'через 1 минут' },
  { phrases: ['минуту назад', 'хвилину тому', 'a minute ago', 'one minute ago'], replacement: '1 минут назад' },
  { phrases: ['через час', 'за годину', 'in an hour', 'in one hour'], replacement: 'через 1 час' },
  { phrases: ['час назад', 'годину тому', 'an hour ago', 'one hour ago'], replacement: '1 час назад' },
  { phrases: ['через день', 'за день', 'in a day', 'in one day'], replacement: 'через 1 день' },
  { phrases: ['день назад', 'день тому', 'a day ago', 'one day ago'], replacement: '1 день назад' },
  { phrases: ['через неделю', 'через тиждень', 'in a week', 'in one week'], replacement: 'через 1 недель' },
  { phrases: ['неделю назад', 'тиждень тому', 'a week ago', 'one week ago'], replacement: '1 недель назад' }
]);

const MONTH_ALIASES = Object.freeze([
  { phrases: ['через месяц', 'через місяць', 'in a month', 'in one month'], months: 1 },
  { phrases: ['месяц назад', 'місяць тому', 'a month ago', 'one month ago'], months: -1 }
]);

function parseLocalDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Temporal Context localDateTime is invalid');
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6]) };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonthsClamped(local, months) {
  const total = local.year * 12 + (local.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12 + 1;
  return {
    ...local,
    year,
    month,
    day: Math.min(local.day, daysInMonth(year, month))
  };
}

function absoluteExpression(local) {
  return `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')} at ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}

function restoreOriginal(result, expression) {
  if (!result || typeof result !== 'object') return result;
  return Object.freeze({ ...result, originalExpression: String(expression), source: 'deterministic-temporal-parser' });
}

export function createTemporalContextService(options = {}) {
  const base = createTemporalService(options);

  function resolveExpression(expression, options = {}) {
    const text = normalized(expression);
    const monthAlias = firstMatch(text, MONTH_ALIASES);
    if (monthAlias) {
      const reference = options.referenceInstant ?? base.now();
      const context = base.contextForTimeZone(options.timeZone, reference);
      const shifted = shiftMonthsClamped(parseLocalDateTime(context.localDateTime), monthAlias.months);
      return restoreOriginal(base.resolveExpression(absoluteExpression(shifted), { ...options, referenceInstant: reference }), expression);
    }
    const alias = firstMatch(text, IMPLICIT_ALIASES);
    if (alias) return restoreOriginal(base.resolveExpression(alias.replacement, options), expression);
    return base.resolveExpression(expression, options);
  }

  async function resolveForUser(globalUserId, expression, options = {}) {
    const setting = await base.getUserTimezone(globalUserId);
    const reference = options.referenceInstant ?? base.now();
    if (!setting) {
      return Object.freeze({ status: 'timezone-required', originalExpression: String(expression), referenceInstant: new Date(reference).toISOString(), timeZone: null, reason: 'user-timezone-unknown' });
    }
    return resolveExpression(expression, { ...options, timeZone: setting.timeZone, referenceInstant: reference });
  }

  return Object.freeze({
    ...base,
    resolveExpression,
    resolveForUser
  });
}
