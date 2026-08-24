const UNIT_MS = Object.freeze({ minute: 60_000, hour: 3_600_000 });

const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  дві: 2, чотири: 4, пʼять: 5, "п'ять": 5, шість: 6, сім: 7, вісім: 8, девʼять: 9, "дев'ять": 9
});

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’`]/g, "'")
    .replace(/[!?;,()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ');
}

function parseNumber(token) {
  if (/^\d+$/.test(token)) return Number(token);
  return NUMBER_WORDS[token] ?? null;
}

function unitKind(token) {
  if (/^(minute|minutes|min|минута|минуты|минут|хвилина|хвилини|хвилин)$/u.test(token)) return 'minute';
  if (/^(hour|hours|hr|час|часа|часов|година|години|годин)$/u.test(token)) return 'hour';
  return null;
}

/**
 * Resolve only elapsed minute/hour offsets. This parser is intentionally
 * narrower than calendar-time parsing: elapsed durations are timezone-free,
 * while dates, dayparts and wall-clock times remain owned by Temporal Context.
 * It is a temporal parameter parser and never decides task intent.
 */
export function resolveElapsedInterval(expression, { referenceInstant = new Date() } = {}) {
  const reference = referenceInstant instanceof Date ? new Date(referenceInstant.getTime()) : new Date(referenceInstant);
  if (!Number.isFinite(reference.getTime())) throw new TypeError('referenceInstant must be a valid instant');

  const tokens = normalize(expression).split(/[^\p{L}\p{N}'-]+/u).filter(Boolean);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const amount = parseNumber(tokens[index]);
    const unit = unitKind(tokens[index + 1]);
    if (!Number.isInteger(amount) || amount < 0 || !unit) continue;

    const before = tokens.slice(Math.max(0, index - 2), index);
    const after = tokens.slice(index + 2, index + 5);
    const future = before.includes('in') || before.includes('через') || before.includes('за') || after.join(' ').includes('from now');
    const past = after.includes('ago') || after.includes('назад') || after.includes('тому') || before.includes('назад') || before.includes('тому');
    if (!future && !past) continue;

    const direction = past ? -1 : 1;
    const instant = new Date(reference.getTime() + amount * UNIT_MS[unit] * direction);
    return Object.freeze({
      status: 'resolved',
      kind: 'elapsed-interval',
      originalExpression: String(expression),
      referenceInstant: reference.toISOString(),
      timeZone: 'UTC',
      localStart: instant.toISOString().replace(/\.\d{3}Z$/, ''),
      utcStart: instant.toISOString(),
      utcEndExclusive: null,
      precision: unit,
      ambiguous: false,
      source: 'deterministic-elapsed-interval'
    });
  }
  return null;
}
