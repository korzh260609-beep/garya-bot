const WEEKDAYS = Object.freeze({ SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 });
const SUPPORTED_FREQ = Object.freeze(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function positiveInteger(value, field, fallback = null) {
  if (value == null && fallback != null) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new TypeError(`${field} must be a positive integer`);
  return number;
}

function parseIntList(value, field, min, max) {
  if (value == null || value === '') return Object.freeze([]);
  const result = String(value).split(',').map((item) => Number(item.trim()));
  if (!result.every((item) => Number.isInteger(item) && item >= min && item <= max)) throw new TypeError(`${field} contains an invalid value`);
  return Object.freeze([...new Set(result)]);
}

function parseByDay(value) {
  if (value == null || value === '') return Object.freeze([]);
  const result = String(value).split(',').map((raw) => {
    const token = raw.trim().toUpperCase();
    const match = token.match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/);
    if (!match) throw new TypeError(`BYDAY contains invalid token: ${raw}`);
    const ordinal = match[1] == null ? null : Number(match[1]);
    if (ordinal === 0 || ordinal < -5 || ordinal > 5) throw new TypeError(`BYDAY ordinal is out of range: ${raw}`);
    return Object.freeze({ weekday: match[2], day: WEEKDAYS[match[2]], ordinal });
  });
  return Object.freeze(result);
}

function parseUntil(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{8}T\d{6}Z$/.test(text)) {
    const iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T${text.slice(9, 11)}:${text.slice(11, 13)}:${text.slice(13, 15)}Z`;
    return new Date(iso).toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(text) && Number.isFinite(Date.parse(text))) return new Date(text).toISOString();
  throw new TypeError('UNTIL must be an absolute UTC instant');
}

export function parseRecurrenceRule(input) {
  const source = typeof input === 'string' ? input.trim() : null;
  const fields = {};
  if (source) {
    const body = source.toUpperCase().startsWith('RRULE:') ? source.slice(6) : source;
    for (const part of body.split(';')) {
      const index = part.indexOf('=');
      if (index <= 0) throw new TypeError(`Invalid recurrence rule part: ${part}`);
      fields[part.slice(0, index).trim().toUpperCase()] = part.slice(index + 1).trim();
    }
  } else if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input)) fields[key.toUpperCase()] = value;
  } else {
    throw new TypeError('recurrence rule must be a string or object');
  }

  const freq = requiredString(fields.FREQ, 'FREQ').toUpperCase();
  if (!SUPPORTED_FREQ.includes(freq)) throw new TypeError(`Unsupported FREQ: ${freq}`);
  const interval = positiveInteger(fields.INTERVAL, 'INTERVAL', 1);
  const count = fields.COUNT == null ? null : positiveInteger(fields.COUNT, 'COUNT');
  const until = parseUntil(fields.UNTIL);
  if (count != null && until != null) throw new TypeError('COUNT and UNTIL are mutually exclusive');

  const byDay = parseByDay(fields.BYDAY);
  const byMonthDay = parseIntList(fields.BYMONTHDAY, 'BYMONTHDAY', -31, 31).filter((item) => item !== 0);
  const byMonth = parseIntList(fields.BYMONTH, 'BYMONTH', 1, 12);
  const byHour = parseIntList(fields.BYHOUR, 'BYHOUR', 0, 23);
  const byMinute = parseIntList(fields.BYMINUTE, 'BYMINUTE', 0, 59);
  if (freq === 'WEEKLY' && byDay.some((item) => item.ordinal != null)) throw new TypeError('Ordinal BYDAY is not supported for WEEKLY');

  return Object.freeze({
    freq, interval, count, until,
    byDay: Object.freeze(byDay),
    byMonthDay: Object.freeze(byMonthDay),
    byMonth: Object.freeze(byMonth),
    byHour: Object.freeze(byHour),
    byMinute: Object.freeze(byMinute),
    canonical: [
      `FREQ=${freq}`,
      interval !== 1 ? `INTERVAL=${interval}` : null,
      byDay.length ? `BYDAY=${byDay.map((item) => `${item.ordinal ?? ''}${item.weekday}`).join(',')}` : null,
      byMonthDay.length ? `BYMONTHDAY=${byMonthDay.join(',')}` : null,
      byMonth.length ? `BYMONTH=${byMonth.join(',')}` : null,
      byHour.length ? `BYHOUR=${byHour.join(',')}` : null,
      byMinute.length ? `BYMINUTE=${byMinute.join(',')}` : null,
      count != null ? `COUNT=${count}` : null,
      until != null ? `UNTIL=${until.replace(/[-:]/g, '').replace('.000', '')}` : null
    ].filter(Boolean).join(';')
  });
}

function parseLocalDateTime(value) {
  const match = requiredString(value, 'dtstartLocal').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new TypeError('dtstartLocal must be YYYY-MM-DDTHH:mm[:ss]');
  return Object.freeze({ year: +match[1], month: +match[2], day: +match[3], hour: +match[4], minute: +match[5], second: +(match[6] ?? 0) });
}

function formatLocal(local) {
  return `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}T${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:${String(local.second ?? 0).padStart(2, '0')}`;
}

function dateOnly(local) {
  return new Date(Date.UTC(local.year, local.month - 1, local.day));
}

function fromDate(date, time) {
  return Object.freeze({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: time.hour, minute: time.minute, second: time.second ?? 0 });
}

function addDays(local, days) {
  const date = dateOnly(local);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDate(date, local);
}

function addMonths(local, months) {
  const total = local.year * 12 + (local.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12 + 1;
  const max = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Object.freeze({ ...local, year, month, day: Math.min(local.day, max) });
}

function monthDayMatches(local, values) {
  if (!values.length) return true;
  const max = new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();
  return values.some((value) => value > 0 ? local.day === value : local.day === max + value + 1);
}

function ordinalWeekdayMatches(local, entry) {
  if (dateOnly(local).getUTCDay() !== entry.day) return false;
  if (entry.ordinal == null) return true;
  const max = new Date(Date.UTC(local.year, local.month, 0)).getUTCDate();
  if (entry.ordinal > 0) return Math.floor((local.day - 1) / 7) + 1 === entry.ordinal;
  return -(Math.floor((max - local.day) / 7) + 1) === entry.ordinal;
}

function byDayMatches(local, values) {
  if (!values.length) return true;
  return values.some((entry) => ordinalWeekdayMatches(local, entry));
}

function monthsBetween(start, local) {
  return (local.year - start.year) * 12 + (local.month - start.month);
}

function yearsBetween(start, local) { return local.year - start.year; }

function weekIndex(start, local) {
  const startDay = dateOnly(start);
  const currentDay = dateOnly(local);
  const startDow = startDay.getUTCDay();
  const mondayDelta = startDow === 0 ? -6 : 1 - startDow;
  startDay.setUTCDate(startDay.getUTCDate() + mondayDelta);
  const currentDow = currentDay.getUTCDay();
  currentDay.setUTCDate(currentDay.getUTCDate() + (currentDow === 0 ? -6 : 1 - currentDow));
  return Math.floor((currentDay - startDay) / 604_800_000);
}

function periodMatches(rule, start, local) {
  if (rule.byMonth.length && !rule.byMonth.includes(local.month)) return false;
  if (!monthDayMatches(local, rule.byMonthDay)) return false;
  if (!byDayMatches(local, rule.byDay)) return false;
  if (rule.freq === 'DAILY') {
    const days = Math.floor((dateOnly(local) - dateOnly(start)) / 86_400_000);
    return days >= 0 && days % rule.interval === 0;
  }
  if (rule.freq === 'WEEKLY') return weekIndex(start, local) >= 0 && weekIndex(start, local) % rule.interval === 0;
  if (rule.freq === 'MONTHLY') return monthsBetween(start, local) >= 0 && monthsBetween(start, local) % rule.interval === 0;
  return yearsBetween(start, local) >= 0 && yearsBetween(start, local) % rule.interval === 0;
}

function timeVariants(rule, start) {
  const hours = rule.byHour.length ? rule.byHour : [start.hour];
  const minutes = rule.byMinute.length ? rule.byMinute : [start.minute];
  const variants = [];
  for (const hour of hours) for (const minute of minutes) variants.push(Object.freeze({ hour, minute, second: start.second }));
  return Object.freeze(variants.sort((a, b) => a.hour - b.hour || a.minute - b.minute || a.second - b.second));
}

async function localToUtc(temporalService, timeZone, local) {
  const result = temporalService.resolveExpression(`${formatLocal(local).slice(0, 10)} at ${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`, { timeZone });
  if (result.status !== 'resolved' || result.ambiguous || !result.utcStart || result.utcEndExclusive) {
    return Object.freeze({ status: 'ambiguous', localDateTime: formatLocal(local), reason: result.ambiguityReason ?? 'unresolvable-local-time' });
  }
  return Object.freeze({ status: 'resolved', localDateTime: formatLocal(local), utcInstant: result.utcStart });
}

export function createRecurrenceEngine({ temporalService } = {}) {
  if (!temporalService?.resolveExpression) throw new TypeError('temporalService is required');

  async function occurrences({ rule: ruleInput, dtstartLocal, timeZone, afterUtc = null, limit = 1, generatedCount = 0, horizonDays = 3660 }) {
    const rule = ruleInput?.freq ? ruleInput : parseRecurrenceRule(ruleInput);
    const start = parseLocalDateTime(dtstartLocal);
    if (!temporalService.isValidTimeZone(timeZone)) throw new TypeError('A valid IANA timezone is required');
    positiveInteger(limit, 'limit');
    const after = afterUtc ? new Date(afterUtc) : null;
    if (after && !Number.isFinite(after.getTime())) throw new TypeError('afterUtc must be a valid instant');
    const until = rule.until ? new Date(rule.until) : null;
    const output = [];
    const times = timeVariants(rule, start);
    let day = Object.freeze({ ...start, hour: 0, minute: 0, second: start.second });
    const maxDays = positiveInteger(horizonDays, 'horizonDays');
    let seen = Number(generatedCount) || 0;

    for (let offset = 0; offset <= maxDays && output.length < limit; offset += 1, day = addDays(day, 1)) {
      if (dateOnly(day) < dateOnly(start)) continue;
      const defaultDayOk = rule.freq === 'WEEKLY' && !rule.byDay.length
        ? dateOnly(day).getUTCDay() === dateOnly(start).getUTCDay()
        : rule.freq === 'MONTHLY' && !rule.byDay.length && !rule.byMonthDay.length
          ? day.day === addMonths(start, monthsBetween(start, day)).day
          : rule.freq === 'YEARLY' && !rule.byDay.length && !rule.byMonthDay.length && !rule.byMonth.length
            ? day.month === start.month && day.day === start.day
            : true;
      if (!defaultDayOk || !periodMatches(rule, start, day)) continue;

      for (const time of times) {
        const local = Object.freeze({ ...day, ...time });
        if (formatLocal(local) < formatLocal(start)) continue;
        const resolved = await localToUtc(temporalService, timeZone, local);
        if (resolved.status !== 'resolved') {
          output.push(Object.freeze({ ...resolved, sequence: seen + 1 }));
          if (output.length >= limit) break;
          continue;
        }
        const utc = new Date(resolved.utcInstant);
        if (until && utc > until) return Object.freeze(output);
        seen += 1;
        if (rule.count != null && seen > rule.count) return Object.freeze(output);
        if (after && utc <= after) continue;
        output.push(Object.freeze({ ...resolved, sequence: seen }));
        if (output.length >= limit) break;
      }
    }
    return Object.freeze(output);
  }

  async function next(input) {
    const list = await occurrences({ ...input, limit: 1 });
    return list[0] ?? null;
  }

  return Object.freeze({ parse: parseRecurrenceRule, occurrences, next });
}
