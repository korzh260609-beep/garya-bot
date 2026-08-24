const UNIT_MS = Object.freeze({ minute: 60_000, hour: 3_600_000 });

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  дві: 2, чотири: 4, пʼять: 5, "п'ять": 5, шість: 6, сім: 7, вісім: 8, девʼять: 9, "дев'ять": 9
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

const DAYPARTS = Object.freeze([
  { phrases: ['morning', 'утро', 'утром', 'ранок', 'вранці'], startHour: 6, endHour: 12 },
  { phrases: ['afternoon', 'daytime', 'днем', 'днём', 'день', 'вдень'], startHour: 12, endHour: 17 },
  { phrases: ['evening', 'вечер', 'вечером', 'вечір', 'ввечері'], startHour: 17, endHour: 22 },
  { phrases: ['night', 'ночь', 'ночью', 'ніч', 'вночі'], startHour: 22, endHour: 24 }
]);

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’`]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[!?;,()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ');
}

function phraseMatch(text, phrase) {
  return ` ${normalizeText(text)} `.includes(` ${normalizeText(phrase)} `);
}

function containsAny(text, phrases) {
  return phrases.some((phrase) => phraseMatch(text, phrase));
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

function partsAt(instant, timeZone) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(instant).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return Object.freeze({
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second)
  });
}

function offsetMilliseconds(instant, timeZone) {
  const local = partsAt(instant, timeZone);
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return localAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function equalLocal(left, right) {
  return left.year === right.year && left.month === right.month && left.day === right.day
    && left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}

function localToCandidates(local, timeZone) {
  const desired = Object.freeze({
    year: Number(local.year), month: Number(local.month), day: Number(local.day),
    hour: Number(local.hour ?? 0), minute: Number(local.minute ?? 0), second: Number(local.second ?? 0)
  });
  const naiveUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  let candidate = new Date(naiveUtc);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = new Date(naiveUtc - offsetMilliseconds(candidate, timeZone));
    if (next.getTime() === candidate.getTime()) break;
    candidate = next;
  }
  const matches = [];
  for (const shift of [-7_200_000, -3_600_000, 0, 3_600_000, 7_200_000]) {
    const probe = new Date(candidate.getTime() + shift);
    if (equalLocal(partsAt(probe, timeZone), desired)) matches.push(probe);
  }
  return Object.freeze([...new Map(matches.map((item) => [item.toISOString(), item])).values()].sort((a, b) => a - b));
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

function validCalendarDate(local) {
  const shifted = calendarShift({ ...local, hour: 0, minute: 0, second: 0 });
  return shifted.year === local.year && shifted.month === local.month && shifted.day === local.day;
}

function startOfLocalDay(local) {
  return Object.freeze({ year: local.year, month: local.month, day: local.day, hour: 0, minute: 0, second: 0 });
}

function parseNumber(token) {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token] ?? null;
}

function unitKind(token) {
  if (/^(minute|minutes|min|минута|минуты|минут|хвилина|хвилини|хвилин)$/u.test(token)) return 'minute';
  if (/^(hour|hours|hr|час|часа|часов|година|години|годин)$/u.test(token)) return 'hour';
  if (/^(day|days|день|дня|дней|дні|днів)$/u.test(token)) return 'day';
  if (/^(week|weeks|неделя|недели|недель|тиждень|тижні|тижнів)$/u.test(token)) return 'week';
  if (/^(month|months|месяц|месяца|месяцев|місяць|місяці|місяців)$/u.test(token)) return 'month';
  return null;
}

function extractClock(text) {
  const value = normalizeText(text);
  let match = value.match(/(?:^|\s)(?:at|в|о)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|утра|утром|дня|днем|днём|вечера|вечером|ночи|ночью|ранку|вранці|вдень|вечора|ввечері|ночі|вночі)?(?=$|\s)/u);
  if (!match) match = value.match(/(?:^|\s)(\d{1,2}):(\d{2})\s*(am|pm)?(?=$|\s)/u);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const marker = match[3] ?? '';
  if (minute > 59 || hour > 23) return null;
  if (marker === 'pm' && hour < 12) hour += 12;
  if (marker === 'am' && hour === 12) hour = 0;
  if (/веч|pm/u.test(marker) && hour < 12) hour += 12;
  if (/дня|днем|днём|вдень/u.test(marker) && hour < 12) hour += 12;
  if (/ноч/u.test(marker) && hour === 12) hour = 0;
  return Object.freeze({ hour, minute, second: 0 });
}

function findDaypart(text) {
  return DAYPARTS.find((item) => containsAny(text, item.phrases)) ?? null;
}

function relativeDayOffset(text) {
  if (containsAny(text, ['day after tomorrow', 'послезавтра', 'післязавтра'])) return 2;
  if (containsAny(text, ['day before yesterday', 'позавчера', 'позавчора'])) return -2;
  if (containsAny(text, ['tomorrow', 'завтра'])) return 1;
  if (containsAny(text, ['yesterday', 'вчера', 'вчора'])) return -1;
  if (containsAny(text, ['today', 'сегодня', 'сьогодні'])) return 0;
  return null;
}

function relativeQuantity(text) {
  const tokens = normalizeText(text).split(/[^\p{L}\p{N}'-]+/u).filter(Boolean);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const amount = parseNumber(tokens[index]);
    const unit = unitKind(tokens[index + 1]);
    if (!Number.isInteger(amount) || amount < 0 || !unit) continue;
    const before = tokens.slice(Math.max(0, index - 2), index);
    const after = tokens.slice(index + 2, index + 5);
    const future = before.includes('in') || before.includes('через') || before.includes('за') || after.join(' ').includes('from now');
    const past = after.includes('ago') || after.includes('назад') || after.includes('тому') || before.includes('назад') || before.includes('тому');
    if (future || past) return Object.freeze({ amount, unit, direction: past ? -1 : 1 });
  }
  return null;
}

function namedWeekday(text) {
  const tokens = new Set(normalizeText(text).split(/[^\p{L}\p{N}'-]+/u).filter(Boolean));
  for (const [name, day] of Object.entries(WEEKDAYS)) if (tokens.has(name)) return day;
  return null;
}

function absoluteDate(text) {
  const value = normalizeText(text);
  let match = value.match(/(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=$|\s)/u);
  if (match) {
    const local = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    return validCalendarDate(local) ? local : null;
  }
  match = value.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})[./](\d{4})(?=$|\s)/u);
  if (!match) return null;
  const local = { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  return validCalendarDate(local) ? local : null;
}

function normalizedResult({ expression, referenceInstant, timeZone, precision, localStart = null, localEndExclusive = null, utcStart = null, utcEndExclusive = null, ambiguous = false, ambiguityReason = null }) {
  return Object.freeze({
    status: 'resolved', originalExpression: String(expression), referenceInstant: referenceInstant.toISOString(), timeZone,
    localStart, localEndExclusive, utcStart, utcEndExclusive, precision, ambiguous, ambiguityReason,
    source: 'deterministic-temporal-parser', confidence: ambiguous ? 0.8 : 1
  });
}

function exactLocalResult(expression, referenceInstant, timeZone, local, precision = 'minute') {
  const candidates = localToCandidates(local, timeZone);
  if (candidates.length === 0) {
    return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(local), ambiguous: true, ambiguityReason: 'nonexistent-local-time-dst-gap' });
  }
  if (candidates.length > 1) {
    return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(local), utcStart: candidates[0].toISOString(), utcEndExclusive: candidates[candidates.length - 1].toISOString(), ambiguous: true, ambiguityReason: 'ambiguous-local-time-dst-overlap' });
  }
  return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(local), utcStart: candidates[0].toISOString() });
}

function rangeForLocalDates(expression, referenceInstant, timeZone, startLocal, endLocal, precision, ambiguous = false, ambiguityReason = null) {
  const starts = localToCandidates(startLocal, timeZone);
  const ends = localToCandidates(endLocal, timeZone);
  if (starts.length !== 1 || ends.length !== 1) {
    return normalizedResult({ expression, referenceInstant, timeZone, precision, localStart: localDateTimeToIso(startLocal), localEndExclusive: localDateTimeToIso(endLocal), ambiguous: true, ambiguityReason: ambiguityReason ?? 'timezone-boundary-ambiguous' });
  }
  return normalizedResult({
    expression, referenceInstant, timeZone, precision,
    localStart: localDateTimeToIso(startLocal), localEndExclusive: localDateTimeToIso(endLocal),
    utcStart: starts[0].toISOString(), utcEndExclusive: ends[0].toISOString(), ambiguous, ambiguityReason
  });
}

function dayRangeResult(expression, referenceInstant, timeZone, local) {
  const start = startOfLocalDay(local);
  return rangeForLocalDates(expression, referenceInstant, timeZone, start, calendarShift(start, { days: 1 }), 'day');
}

function mondayStart(local) {
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return startOfLocalDay(calendarShift(local, { days: offset }));
}

function customRangeResult(expression, referenceInstant, timeZone) {
  const localPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
  const parseLocal = (value, field) => {
    const match = String(value ?? '').match(localPattern);
    if (!match) throw new TypeError(`${field} must be a local ISO date-time without offset`);
    const local = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6]) };
    if (!validCalendarDate(local) || local.hour > 23 || local.minute > 59 || local.second > 59) throw new TypeError(`${field} is invalid`);
    return local;
  };
  const start = parseLocal(expression.localStart, 'timeExpression.localStart');
  const end = parseLocal(expression.localEndExclusive, 'timeExpression.localEndExclusive');
  const result = rangeForLocalDates(expression.type, referenceInstant, timeZone, start, end, 'custom-range');
  if (result.utcStart && result.utcEndExclusive && Date.parse(result.utcStart) >= Date.parse(result.utcEndExclusive)) {
    throw new TypeError('timeExpression custom range end must be after start');
  }
  return result;
}

function daypartResult(expression, referenceInstant, timeZone, local, daypart) {
  const start = { ...local, hour: daypart.startHour, minute: 0, second: 0 };
  const end = daypart.endHour === 24
    ? { ...calendarShift(local, { days: 1 }), hour: 0, minute: 0, second: 0 }
    : { ...local, hour: daypart.endHour, minute: 0, second: 0 };
  return rangeForLocalDates(expression, referenceInstant, timeZone, start, end, 'daypart', true, 'broad-daypart');
}

function weekDirection(text) {
  if (containsAny(text, ['next week', 'следующая неделя', 'следующей неделе', 'следующую неделю', 'наступний тиждень', 'наступного тижня'])) return 1;
  if (containsAny(text, ['last week', 'previous week', 'прошлая неделя', 'прошлой неделе', 'прошлую неделю', 'минулий тиждень', 'минулого тижня'])) return -1;
  if (containsAny(text, ['this week', 'эта неделя', 'этой неделе', 'эту неделю', 'цей тиждень', 'цього тижня'])) return 0;
  return null;
}

function monthDirection(text) {
  if (containsAny(text, ['next month', 'следующий месяц', 'следующем месяце', 'наступний місяць', 'наступного місяця'])) return 1;
  if (containsAny(text, ['last month', 'previous month', 'прошлый месяц', 'прошлом месяце', 'минулий місяць', 'минулого місяця'])) return -1;
  if (containsAny(text, ['this month', 'этот месяц', 'этом месяце', 'цей місяць', 'цього місяця'])) return 0;
  return null;
}

export function createInMemoryTimezoneStore() {
  const values = new Map();
  return Object.freeze({
    async get(globalUserId) { return values.get(globalUserId) ?? null; },
    async set(globalUserId, record) {
      const frozen = Object.freeze({ ...record });
      values.set(globalUserId, frozen);
      return frozen;
    }
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
    if (typeof globalUserId !== 'string' || globalUserId.trim() === '') throw new TypeError('globalUserId is required');
    const zone = requireTimeZone(timeZone);
    return timezoneStore.set(globalUserId.trim(), Object.freeze({ timeZone: zone, source, provenance, updatedAt: now().toISOString() }));
  }

  function contextForTimeZone(timeZone, reference = now()) {
    const zone = requireTimeZone(timeZone);
    const instant = assertDate(reference, 'reference');
    const local = partsAt(instant, zone);
    return Object.freeze({
      referenceInstant: instant.toISOString(), utc: instant.toISOString(), timeZone: zone,
      localDate: localDateToIso(local), localDateTime: localDateTimeToIso(local),
      weekday: new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long' }).format(instant),
      offsetMinutes: Math.round(offsetMilliseconds(instant, zone) / 60_000)
    });
  }

  async function contextForUser(globalUserId, reference = now()) {
    const instant = assertDate(reference, 'reference');
    const setting = await getUserTimezone(globalUserId);
    if (!setting) {
      return Object.freeze({ referenceInstant: instant.toISOString(), utc: instant.toISOString(), timeZone: null, localDate: null, localDateTime: null, weekday: null, offsetMinutes: null, timezoneKnown: false });
    }
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
      const target = { ...absolute, hour: clockTime?.hour ?? 0, minute: clockTime?.minute ?? 0, second: 0 };
      if (clockTime) return exactLocalResult(expression, reference, zone, target);
      if (daypart) return daypartResult(expression, reference, zone, target, daypart);
      return dayRangeResult(expression, reference, zone, target);
    }

    const dayOffset = relativeDayOffset(text);
    if (dayOffset != null) {
      const target = calendarShift(localNow, { days: dayOffset });
      if (clockTime) return exactLocalResult(expression, reference, zone, { ...target, ...clockTime });
      if (daypart) return daypartResult(expression, reference, zone, target, daypart);
      return dayRangeResult(expression, reference, zone, target);
    }

    const relative = relativeQuantity(text);
    if (relative) {
      if (relative.unit === 'minute' || relative.unit === 'hour') {
        const instant = new Date(reference.getTime() + relative.amount * UNIT_MS[relative.unit] * relative.direction);
        return normalizedResult({ expression, referenceInstant: reference, timeZone: zone, precision: relative.unit, localStart: localDateTimeToIso(partsAt(instant, zone)), utcStart: instant.toISOString() });
      }
      const shifted = calendarShift(localNow, {
        days: relative.unit === 'day' ? relative.amount * relative.direction : relative.unit === 'week' ? relative.amount * 7 * relative.direction : 0,
        months: relative.unit === 'month' ? relative.amount * relative.direction : 0
      });
      const target = clockTime ? { ...shifted, ...clockTime } : { ...shifted, hour: localNow.hour, minute: localNow.minute, second: localNow.second };
      return exactLocalResult(expression, reference, zone, target, relative.unit);
    }

    const weekday = namedWeekday(text);
    if (weekday != null) {
      const currentWeekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay();
      let delta = (weekday - currentWeekday + 7) % 7;
      if (containsAny(text, ['next', 'следующий', 'следующую', 'следующем', 'наступний', 'наступну', 'наступного']) && delta === 0) delta = 7;
      if (containsAny(text, ['previous', 'last', 'прошлый', 'прошлую', 'прошлом', 'минулий', 'минулу', 'минулого'])) delta = delta === 0 ? -7 : delta - 7;
      const target = calendarShift(localNow, { days: delta });
      if (clockTime) return exactLocalResult(expression, reference, zone, { ...target, ...clockTime });
      if (daypart) return daypartResult(expression, reference, zone, target, daypart);
      return dayRangeResult(expression, reference, zone, target);
    }

    const week = weekDirection(text);
    if (week != null) {
      const currentWeekday = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day)).getUTCDay();
      const mondayOffset = currentWeekday === 0 ? -6 : 1 - currentWeekday;
      const start = startOfLocalDay(calendarShift(localNow, { days: mondayOffset + week * 7 }));
      return rangeForLocalDates(expression, reference, zone, start, calendarShift(start, { days: 7 }), 'week', Boolean(daypart), daypart ? 'broad-daypart-within-week' : null);
    }

    const month = monthDirection(text);
    if (month != null) {
      const shifted = calendarShift({ ...localNow, day: 1 }, { months: month });
      const start = { ...shifted, day: 1, hour: 0, minute: 0, second: 0 };
      return rangeForLocalDates(expression, reference, zone, start, calendarShift(start, { months: 1 }), 'month');
    }

    if (containsAny(text, ['now', 'сейчас', 'зараз'])) {
      return normalizedResult({ expression, referenceInstant: reference, timeZone: zone, precision: 'second', localStart: localDateTimeToIso(localNow), utcStart: reference.toISOString() });
    }

    return Object.freeze({ status: 'unresolved', originalExpression: String(expression), referenceInstant: reference.toISOString(), timeZone: zone, reason: 'no-supported-temporal-expression' });
  }

  function resolveCanonicalExpression(expression, { timeZone, referenceInstant = now() } = {}) {
    if (!expression || typeof expression !== 'object' || Array.isArray(expression)) throw new TypeError('canonical timeExpression must be an object');
    const type = String(expression.type ?? '').trim();
    const zone = requireTimeZone(timeZone);
    const reference = assertDate(referenceInstant, 'referenceInstant');
    const localNow = partsAt(reference, zone);
    let result;
    if (type === 'previous-calendar-day') {
      result = dayRangeResult(type, reference, zone, calendarShift(localNow, { days: -1 }));
    } else if (type === 'current-calendar-day') {
      result = dayRangeResult(type, reference, zone, localNow);
    } else if (type === 'rolling-24-hours') {
      const start = new Date(reference.getTime() - 86_400_000);
      result = normalizedResult({
        expression: type, referenceInstant: reference, timeZone: zone, precision: 'rolling-24-hours',
        localStart: localDateTimeToIso(partsAt(start, zone)), localEndExclusive: localDateTimeToIso(partsAt(reference, zone)),
        utcStart: start.toISOString(), utcEndExclusive: reference.toISOString()
      });
    } else if (type === 'previous-week' || type === 'current-week') {
      const currentMonday = mondayStart(localNow);
      const start = type === 'previous-week' ? calendarShift(currentMonday, { days: -7 }) : currentMonday;
      result = rangeForLocalDates(type, reference, zone, start, calendarShift(start, { days: 7 }), 'week');
    } else if (type === 'custom-range') {
      result = customRangeResult(expression, reference, zone);
    } else {
      throw new TypeError(`unsupported canonical timeExpression.type: ${type}`);
    }
    return Object.freeze({
      ...expression,
      type,
      referenceInstant: result.referenceInstant,
      timeZone: result.timeZone,
      localStart: result.localStart,
      localEndExclusive: result.localEndExclusive,
      utcStart: result.utcStart,
      utcEndExclusive: result.utcEndExclusive,
      precision: result.precision,
      ambiguous: result.ambiguous,
      source: 'deterministic-canonical-temporal-resolver'
    });
  }

  async function resolveForUser(globalUserId, expression, options = {}) {
    const reference = assertDate(options.referenceInstant ?? now(), 'referenceInstant');
    const setting = await getUserTimezone(globalUserId);
    if (!setting) return Object.freeze({ status: 'timezone-required', originalExpression: String(expression), referenceInstant: reference.toISOString(), timeZone: null, reason: 'user-timezone-unknown' });
    return resolveExpression(expression, { ...options, timeZone: setting.timeZone, referenceInstant: reference });
  }

  async function enrichInput(input) {
    const reference = now();
    const globalUserId = input?.identityContext?.globalUserId;
    const temporalContext = globalUserId
      ? await contextForUser(globalUserId, reference)
      : Object.freeze({ referenceInstant: reference.toISOString(), utc: reference.toISOString(), timeZone: null, timezoneKnown: false });
    return Object.freeze({ ...input, metadata: Object.freeze({ ...(input?.metadata ?? {}), temporalContext }) });
  }

  return Object.freeze({
    now, isValidTimeZone, getUserTimezone, setUserTimezone, contextForTimeZone, contextForUser,
    resolveExpression, resolveCanonicalExpression, resolveForUser, enrichInput
  });
}
