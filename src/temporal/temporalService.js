const UNIT_MS = Object.freeze({ minute: 60_000, hour: 3_600_000 });

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  один: 1, одна: 1, два: 2, дві: 2, три: 3, чотири: 4, пʼять: 5, "п'ять": 5, шість: 6, сім: 7, вісім: 8, девʼять: 9, "дев'ять": 9, десять: 10
});

const WEEKDAYS = Object.freeze({
  monday: 1, mon: 1, понедельник: 1, понеділок: 1,
  tuesday: 2, tue: 2, вторник: 2, вівторок: 2,
  wednesday: 3, wed: 3, среда: 3, середа: 3,
  thursday: 4, thu: 4, четверг: 4, четвер: 4,
  friday: 5, fri: 5, пятница: 5, "п'ятниця": 5, пʼятниця: 5,
  saturday: 6, sat: 6, суббота: 6, субота: 6,
  sunday: 0, sun: 0, воскресенье: 0, неділя: 0
});

const DAYPARTS = Object.freeze({
  morning: [6, 12], утро: [6, 12], утром: [6, 12], ранок: [6, 12], вранці: [6, 12],
  afternoon: [12, 17], day: [12, 17], днем: [12, 17], днём: [12, 17], день: [12, 17], вдень: [12, 17],
  evening: [17, 22], вечер: [17, 22], вечером: [17, 22], вечір: [17, 22], ввечері: [17, 22],
  night: [22, 24], ночь: [22, 24], ночью: [22, 24], ніч: [22, 24], вночі: [22, 24]
});

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

function assertDate(value, field = 'instant') {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${field} must be a valid instant`);
  return date;
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function requireTimeZone(timeZone) {
  if (!isValidTimeZone(timeZone)) throw new TypeError('A valid IANA timezone is required');
  return timeZone.trim();
}

function formatter(timeZone, options = {}) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    ...options
  });
}

function partsAt(instant, timeZone) {
  const values = Object.fromEntries(formatter(timeZone).formatToParts(instant).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return Object.freeze({
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second)
  });
}

function offsetMilliseconds(instant, timeZone) {
  const p = partsAt(instant, timeZone);
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return localAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function equalLocal(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute && a.second === b.second;
}

function localToCandidates(local, timeZone) {
  const naiveUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour ?? 0, local.minute ?? 0, local.second ?? 0);
  let candidate = new Date(naiveUtc);
  for (let index = 0; index < 4; index += 1) {
    const next = new Date(naiveUtc - offsetMilliseconds(candidate, timeZone));
    if (next.getTime() === candidate.getTime()) break;
    candidate = next;
  }

  const desired = { ...local, hour: local.hour ?? 0, minute: local.minute ?? 0, second: local.second ?? 0 };
  const matches = [];
  for (const shift of [-7_200_000, -3_600_000, 0, 3_600_000, 7_200_000]) {
    const probe = new Date(candidate.getTime() + shift);
    if (equalLocal(partsAt(probe, timeZone), desired)) matches.push(probe);
  }
  const unique = [...new Map(matches.map((item) => [item.toISOString(), item])).values()].sort((a, b) => a - b);
  return Object.freeze(unique);
}

function localDateToIso(local) {
  return `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
}

function localDateTimeToIso(local) {
  return `${localDateToIso(local)}T${String(local.hour ?? 0).padStart(2, '0')}:${String(local.minute ?? 0).padStart(2, '0')}:${String(local.second ?? 0).padStart(2, '0')}`;
}

function calendarShift(local, { days = 0, months = 0 } = {}) {
  const date = new Date(Date.UTC(local.year, local.month - 1 + months, local.day + days, local.hour ?? 0, local.minute ?? 0, local.second ?? 0));
  return Object.freeze({
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds()
  });
}

function startOfLocalDay(local) {
  return Object.freeze({ year: local.year, month: local.month, day: local.day, hour: 0, minute: 0, second: 0 });
}

function dayRange(local, timeZone) {
  const startLocal = startOfLocalDay(local);
  const endLocal = calendarShift(startLocal, { days: 1 });
  const starts = localToCandidates(startLocal, timeZone);
  const ends = localToCandidates(endLocal, timeZone);
  if (starts.length !== 1 || ends.length !== 1) throw new Error('Unable to resolve local calendar-day boundary');
  return Object.freeze({
    localStart: localDateTimeToIso(startLocal), localEndExclusive: localDateTimeToIso(endLocal),
    utcStart: starts[0].toISOString(), utcEndExclusive: ends[0].toISOString()
  });
}

function parseNumber(token) {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token] ?? null;
}

function unitKind(token) {
  if (/^(minute|minutes|min|минута|минуты|минут|хвилина|хвилини|хвилин)$/.test(token)) return 'minute';
  if (/^(hour|hours|hr|час|часа|часов|година|години|годин)$/.test(token)) return 'hour';
  if (/^(day|days|день|дня|дней|день|дні|днів)$/.test(token)) return 'day';
  if (/^(week|weeks|неделя|недели|недель|тиждень|тижні|тижнів)$/.test(token)) return 'week';
  if (/^(month|months|месяц|месяца|месяцев|місяць|місяці|місяців)$/.test(token)) return 'month';
  return null;
}

function extractClock(text) {
  let match = text.match(/(?:^|\s)(?:at|в|о)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|утра|утром|дня|днем|днём|вечера|вечером|ночи|ночью|ранку|вранці|дня|вдень|вечора|ввечері|ночі|вночі)?\b/u);
  if (!match) match = text.match(/\b(\d{1,2}):(\d{2})\b/u);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const marker = match[3] ?? '';
  if (minute > 59 || hour > 23) return null;
  if (marker === 'pm' && hour < 12) hour += 12;
  if (marker === 'am' && hour === 12) hour = 0;
  if (/веч|pm/.test(marker) && hour < 12) hour += 12;
  if (/дня|днем|днём|вдень/.test(marker) && hour < 12) hour += 12;
  if (/ноч/.test(marker) && hour === 12) hour = 0;
  return Object.freeze({ hour, minute, second: 0 });
}

function findDaypart(text) {
  for (const [key, value] of Object.entries(DAYPARTS)) {
    if (new RegExp(`(^|\\s)${key}($|\\s)`, 'u').test(text)) return Object.freeze({ key, startHour: value[0], endHour: value[1] });
  }
  return null;
}

function relativeDayOffset(text) {
  if (/\b(day after tomorrow|послезавтра|післязавтра)\b/u.test(text)) return 2;
  if (/\b(day before yesterday|позавчера|позавчора)\b/u.test(text)) return -2;
  if (/\b(tomorrow|завтра)\b/u.test(text)) return 1;
  if (/\b(yesterday|вчера|вчора)\b/u.test(text)) return -1;
  if (/\b(today|сегодня|сьогодні)\b/u.test(text)) return 0;
  return null;
}

function relativeQuantity(text) {
  const tokens = text.split(/[^\p{L}\p{N}'ʼ]+/u).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const amount = parseNumber(tokens[i]);
    const unit = unitKind(tokens[i + 1]);
    if (!Number.isInteger(amount) || amount < 0 || !unit) continue;
    const before = tokens.slice(Math.max(0, i - 2), i).join(' ');
    const after = tokens.slice(i + 2, i + 5).join(' ');
    const future = /(^| )(in|через|за)$/.test(before) || /^(from now)/.test(after);
    const past = /(^| )(ago|назад|тому)$/.test(after) || /(^| )(назад|тому)$/.test(before);
    if (future || past) return Object.freeze({ amount, unit, direction: past ? -1 : 1 });
  }
  const match = text.match(/(?:in|через|за)\s+(\d+)\s+([\p{L}]+)/u) ?? text.match(/(\d+)\s+([\p{L}]+)\s+(?:ago|назад|тому)/u);
  if (!match) return null;
  const unit = unitKind(match[2]);
  if (!unit) return null;
  return Object.freeze({ amount: Number(match[1]), unit, direction: /ago|назад|тому/u.test(match[0]) ? -1 : 1 });
}

function namedWeekday(text) {
  for (const [name, day] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`(^|\\s)${name}($|\\s)`, 'u').test(text)) return day;
  }
  return null;
}

function absoluteDate(text) {
  let match = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/u);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  match = text.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/u);
  if (match) return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  return null;
}

function normalizedResult({ expression, referenceInstant, timeZone, precision, localStart = null, localEndExclusive = null, utcStart = null, utcEndExclusive = null, ambiguous = false, ambiguityReason = null, source = 'deterministic-temporal-parser' }) {
  return Object.freeze({
    status: 'resolved', originalExpression: expression, referenceInstant: referenceInstant.toISOString(), timeZone,
    localStart, localEndExclusive, utcStart, utcEndExclusive, precision, ambiguous, ambiguityReason,
    source, confidence: ambiguous ? 0.8 : 1
  });
}

function exactLocalResult(expression, referenceInstant, timeZone, local, precision = 'minute') {
  const candidates = localToCandidates(local, timeZone);
  if (candidates.length === 0) return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(local), ambiguous: true, ambiguityReason: 'nonexistent-local-time-dst-gap' });
  if (candidates.length > 1) return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(local), utcStart: candidates[0].toISOString(), utcEndExclusive: candidates[candidates.length - 1].toISOString(), ambiguous: true, ambiguityReason: 'ambiguous-local-time-dst-overlap' });
  return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(local), utcStart: candidates[0].toISOString() });
}

function rangeForLocalDates(expression, referenceInstant, timeZone, startLocal, endLocal, precision, ambiguous = false, ambiguityReason = null) {
  const starts = localToCandidates(startLocal, timeZone);
  const ends = localToCandidates(endLocal, timeZone);
  if (starts.length !== 1 || ends.length !== 1) return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(startLocal), localEndExclusive: localDateTimeToIso(endLocal), ambiguous: true, ambiguityReason: ambiguityReason ?? 'timezone-boundary-ambiguous' });
  return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(startLocal), localEndExclusive: localDateTimeToIso(endLocal), utcStart: starts[0].toISOString(), utcEndExclusive: ends[0].toISOString(), ambiguous, ambiguityReason });
}

export function createInMemoryTimezoneStore() {
  const values = new Map();
  return Object.freeze({
    async get(globalUserId) { return values.get(globalUserId) ?? null; },
    async set(globalUserId, record) { values.set(globalUserId, Object.freeze({ ...record })); return values.get(globalUserId); }
  });
}

export function createTemporalService({ clock = () => new Date(), timezoneStore = createInMemoryTimezoneStore() } = {}) {
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');
  if (!timezoneStore?.get || !timezoneStore?.set) throw new TypeError('timezoneStore must implement get/set');

  function now() { return assertDate(clock(), 'clock result'); }

  async function getUserTimezone(globalUserId) {
    if (typeof globalUserId !== 'string' || globalUserId.trim() === '') throw new TypeError('globalUserId is required');
    const record = await timezoneStore.get(globalUserId.trim());
    if (!record?.timeZone || !isValidTimeZone(record.timeZone)) return null;
    return Object.freeze({ ...record, timeZone: record.timeZone.trim() });
  }

  async function setUserTimezone(globalUserId, timeZone, { source = 'user-explicit', provenance = null } = {}) {
    const zone = requireTimeZone(timeZone);
    const record = Object.freeze({ timeZone: zone, source, provenance, updatedAt: now().toISOString() });
    return timezoneStore.set(globalUserId, record);
  }

  function contextForTimeZone(timeZone, reference = now()) {
    const zone = requireTimeZone(timeZone);
    const instant = assertDate(reference, 'reference');
    const local = partsAt(instant, zone);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long' }).format(instant);
    const offsetMinutes = Math.round(offsetMilliseconds(instant, zone) / 60_000);
    return Object.freeze({
      referenceInstant: instant.toISOString(), utc: instant.toISOString(), timeZone: zone,
      localDate: localDateToIso(local), localDateTime: localDateTimeToIso(local), weekday, offsetMinutes
    });
  }

  async function contextForUser(globalUserId, reference = now()) {
    const setting = await getUserTimezone(globalUserId);
    const instant = assertDate(reference, 'reference');
    if (!setting) return Object.freeze({ referenceInstant: instant.toISOString(), utc: instant.toISOString(), timeZone: null, localDate: null, localDateTime: null, weekday: null, offsetMinutes: null, timezoneKnown: false });
    return Object.freeze({ ...contextForTimeZone(setting.timeZone, instant), timezoneKnown: true, timezoneSource: setting.source ?? null });
  }

  function resolveExpression(expression, { timeZone, referenceInstant = now() } = {}) {
    const zone = requireTimeZone(timeZone);
    const reference = assertDate(referenceInstant, 'referenceInstant');
    const text = normalizeText(expression);
    if (!text) return Object.freeze({ status: 'unresolved', originalExpression: String(expression ?? ''), referenceInstant: reference.toISOString(), timeZone: zone, reason: 'empty-expression' });
    const localNow = partsAt(reference, zone);
    const clockTime = extractClock(text);
    const daypart = findDaypart(text);

    const absolute = absoluteDate(text);
    if (absolute) {
      const base = { ...absolute, hour: clockTime?.hour ?? 0, minute: clockTime?.minute ?? 0, second: 0 };
      if (clockTime) return exactLocalResult(expression, reference, zone, base);
      if (daypart) return rangeForLocalDates(expression, reference, zone, { ...base, hour: daypart.startHour }, { ...base, hour: daypart.endHour === 24 ? 0 : daypart.endHour, ...(daypart.endHour === 24 ? calendarShift(base, { days: 1 }) : {}) }, 'daypart', true, 'broad-daypart');
      const range = dayRange(base, zone);
      return normalizedResult({ expression, referenceInstant: reference, timeZone: zone, precision: 'day', ...range });
    }

    const dayOffset = relativeDayOffset(text);
    if (dayOffset != null) {
      const target = calendarShift(localNow, { days: dayOffset });
      if (clockTime) return exactLocalResult(expression, reference, zone, { ...target, ...clockTime });
      if (daypart) {
        const start = { ...target, hour: daypart.startHour, minute: 0, second: 0 };
        const end = daypart.endHour === 24 ? { ...calendarShift(target, { days: 1 }), hour: 0, minute: 0, second: 0 } : { ...target, hour: daypart.endHour, minute: 0, second: 0 };
        return rangeForLocalDates(expression, reference, zone, start, end, 'daypart', true, 'broad-daypart');
      }
      const range = dayRange(target, zone);
      return normalizedResult({ expression, referenceInstant: reference, timeZone: zone, precision: 'day', ...range });
    }

    const relative = relativeQuantity(text);
    if (relative) {
      if (relative.unit === 'minute' || relative.unit === 'hour') {
        const delta = relative.amount * UNIT_MS[relative.unit] * relative.direction;
        const instant = new Date(reference.getTime() + delta);
        const local = partsAt(instant, zone);
        return normalizedResult({ expression, referenceInstant: reference, timeZone: zone, precision: relative.unit, localStart: localDateTimeToIso(local), utcStart: instant.toISOString() });
      }
      const days = relative.unit === 'day' ? relative.amount * relative.direction : relative.unit === 'week' ? relative.amount * 7 * relative.direction : 0;
      const months = relative.unit === 'month' ? relative.amount * relative.direction : 0;
      const target = calendarShift(localNow, { days, months });
      if (clockTime) return exactLocalResult(expression, reference, zone, { ...target, ...clockTime });
      const sameClock = { ...target, hour: localNow.hour, minute: localNow.minute, second: localNow.second };
      return exactLocalResult(expression, reference, zone, sameClock, relative.unit);
    }

    const weekday = namedWeekday(text);
    if (weekday != null) {
      const currentWeekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay();
      let delta = (weekday - currentWeekday + 7) % 7;
      if (/\b(next|следующ|наступн)/u.test(text) && delta === 0) delta = 7;
      if (/\b(previous|last|прошл|минул)/u.test(text)) delta = delta === 0 ? -7 : delta - 7;
      const target = calendarShift(localNow, { days: delta });
      if (clockTime) return exactLocalResult(expression, reference, zone, { ...target, ...clockTime });
      const range = dayRange(target, zone);
      return normalizedResult({ expression, referenceInstant: reference, timeZone: zone, precision: 'day', ...range });
    }

    const weekDirection = /\b(next week|следующ(?:ая|ей) недел|наступн(?:ий|ого) тиж)/u.test(text) ? 1 : /\b(last week|previous week|прошл(?:ая|ой) недел|минул(?:ий|ого) тиж)/u.test(text) ? -1 : /\b(this week|эта недел|этой недел|цей тиж)/u.test(text) ? 0 : null;
    if (weekDirection != null) {
      const currentWeekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay();
      const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
      const start = startOfLocalDay(calendarShift(localNow, { days: mondayOffset + weekDirection * 7 }));
      const end = calendarShift(start, { days: 7 });
      return rangeForLocalDates(expression, reference, zone, start, end, 'week', Boolean(daypart), daypart ? 'broad-daypart-within-week' : null);
    }

    const monthDirection = /\b(next month|следующ(?:ий|его) месяц|наступн(?:ий|ого) місяц)/u.test(text) ? 1 : /\b(last month|previous month|прошл(?:ый|ого) месяц|минул(?:ий|ого) місяц)/u.test(text) ? -1 : /\b(this month|эт(?:от|ом) месяц|цей місяц)/u.test(text) ? 0 : null;
    if (monthDirection != null) {
      const shifted = calendarShift({ ...localNow, day: 1 }, { months: monthDirection });
      const start = { ...shifted, day: 1, hour: 0, minute: 0, second: 0 };
      const end = calendarShift(start, { months: 1 });
      return rangeForLocalDates(expression, reference, zone, start, end, 'month');
    }

    if (clockTime && /\b(now|сейчас|зараз|today|сегодня|сьогодні)\b/u.test(text)) {
      return exactLocalResult(expression, reference, zone, { ...localNow, ...clockTime });
    }

    return Object.freeze({ status: 'unresolved', originalExpression: expression, referenceInstant: reference.toISOString(), timeZone: zone, reason: 'no-supported-temporal-expression' });
  }

  async function resolveForUser(globalUserId, expression, options = {}) {
    const setting = await getUserTimezone(globalUserId);
    if (!setting) return Object.freeze({ status: 'timezone-required', originalExpression: expression, referenceInstant: assertDate(options.referenceInstant ?? now()).toISOString(), timeZone: null, reason: 'user-timezone-unknown' });
    return resolveExpression(expression, { ...options, timeZone: setting.timeZone });
  }

  async function enrichInput(input) {
    const globalUserId = input?.identityContext?.globalUserId;
    const temporalContext = globalUserId ? await contextForUser(globalUserId) : Object.freeze({ referenceInstant: now().toISOString(), utc: now().toISOString(), timeZone: null, timezoneKnown: false });
    return Object.freeze({
      ...input,
      metadata: Object.freeze({ ...(input?.metadata ?? {}), temporalContext })
    });
  }

  return Object.freeze({
    now, isValidTimeZone, getUserTimezone, setUserTimezone, contextForTimeZone, contextForUser,
    resolveExpression, resolveForUser, enrichInput
  });
}
