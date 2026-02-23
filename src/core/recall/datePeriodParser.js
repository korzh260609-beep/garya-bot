// src/core/recall/datePeriodParser.js
// STAGE 8A.1 — Date/period parser (MVP, no external deps)
// Purpose: parse user text into a recall time window.
// Notes:
// - Uses UTC day boundaries to avoid server-local timezone ambiguity.
// - Keeps logic conservative: if unsure → returns type:"none".
// - Future steps will wire this into RecallEngine.recall().

function toInt(x) {
  const n = Number.parseInt(String(x), 10);
  return Number.isFinite(n) ? n : null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// UTC day helpers
function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function endOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
function addUtcDays(d, days) {
  const base = startOfUtcDay(d);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function clampFutureToNowEnd(from, to, nowUtc = new Date()) {
  const nowEnd = endOfUtcDay(nowUtc);
  const clampedTo = to > nowEnd ? nowEnd : to;
  const clampedFrom = from > nowEnd ? nowEnd : from;
  return { from: clampedFrom, to: clampedTo };
}

function parseIsoDateYYYYMMDD(s) {
  // YYYY-MM-DD
  const m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!m) return null;
  const y = toInt(m[1]);
  const mo = toInt(m[2]);
  const d = toInt(m[3]);
  if (!y || !mo || !d) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  // Create UTC date at noon to avoid DST edge cases when converting
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  // Validate roundtrip
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function parseDotOrSlashDateDDMMYYYY(s) {
  // DD.MM.YYYY or DD/MM/YYYY
  const m = s.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
  if (!m) return null;
  const d = toInt(m[1]);
  const mo = toInt(m[2]);
  const y = toInt(m[3]);
  if (!y || !mo || !d) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function findFirstDate(text) {
  return parseIsoDateYYYYMMDD(text) || parseDotOrSlashDateDDMMYYYY(text);
}

function norm(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseRelativeDay(textNorm, nowUtc) {
  // UA/RU/EN
  // today / сьогодні / сегодня
  // yesterday / вчора / вчера
  // day before yesterday / позавчора / позавчера
  // last N days / past N days / за N днів / за N дней
  if (!textNorm) return null;

  const todayRe = /\b(today|сегодня|сьогодні)\b/;
  const yesterdayRe = /\b(yesterday|вчера|вчора)\b/;
  const beforeYesterdayRe = /\b(day before yesterday|позавчера|позавчора)\b/;

  if (beforeYesterdayRe.test(textNorm)) {
    const d = addUtcDays(nowUtc, -2);
    return { type: "day", from: startOfUtcDay(d), to: endOfUtcDay(d), confidence: 0.9 };
  }
  if (yesterdayRe.test(textNorm)) {
    const d = addUtcDays(nowUtc, -1);
    return { type: "day", from: startOfUtcDay(d), to: endOfUtcDay(d), confidence: 0.9 };
  }
  if (todayRe.test(textNorm)) {
    const d = addUtcDays(nowUtc, 0);
    return { type: "day", from: startOfUtcDay(d), to: endOfUtcDay(d), confidence: 0.9 };
  }

  // last/past N days (range)
  const lastDays =
    textNorm.match(/\b(last|past)\s+(\d{1,3})\s+days?\b/) ||
    textNorm.match(/\bза\s+(\d{1,3})\s+(днів|дня|день|дней|дня|день)\b/) ||
    textNorm.match(/\b(\d{1,3})\s*d\b/);

  if (lastDays) {
    // pick the first numeric group found
    const n =
      toInt(lastDays[2]) ??
      toInt(lastDays[1]) ??
      toInt(lastDays[0]?.match(/(\d{1,3})/)?.[1]);
    if (n && n >= 1 && n <= 365) {
      const to = endOfUtcDay(nowUtc);
      const from = startOfUtcDay(addUtcDays(nowUtc, -(n - 1)));
      return { type: "range", from, to, confidence: 0.75 };
    }
  }

  return null;
}

function parseExplicitRange(textNorm, nowUtc) {
  // between X and Y / from X to Y
  // з X по Y / c X по Y
  // also supports "X - Y" where X and Y are dates
  const raw = textNorm;

  // 1) between ... and ...
  let m = raw.match(/\bbetween\s+(.+?)\s+and\s+(.+)\b/);
  if (m) {
    const d1 = findFirstDate(m[1]);
    const d2 = findFirstDate(m[2]);
    if (d1 && d2) {
      const a = startOfUtcDay(d1);
      const b = endOfUtcDay(d2);
      const from = a <= b ? a : startOfUtcDay(d2);
      const to = a <= b ? b : endOfUtcDay(d1);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc), confidence: 0.85 };
    }
  }

  // 2) from ... to ...
  m = raw.match(/\bfrom\s+(.+?)\s+to\s+(.+)\b/);
  if (m) {
    const d1 = findFirstDate(m[1]);
    const d2 = findFirstDate(m[2]);
    if (d1 && d2) {
      const a = startOfUtcDay(d1);
      const b = endOfUtcDay(d2);
      const from = a <= b ? a : startOfUtcDay(d2);
      const to = a <= b ? b : endOfUtcDay(d1);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc), confidence: 0.85 };
    }
  }

  // 3) з ... по ...  / c ... по ...
  m = raw.match(/\b(з|с)\s+(.+?)\s+по\s+(.+)\b/);
  if (m) {
    const d1 = findFirstDate(m[2]);
    const d2 = findFirstDate(m[3]);
    if (d1 && d2) {
      const a = startOfUtcDay(d1);
      const b = endOfUtcDay(d2);
      const from = a <= b ? a : startOfUtcDay(d2);
      const to = a <= b ? b : endOfUtcDay(d1);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc), confidence: 0.85 };
    }
  }

  // 4) "YYYY-MM-DD - YYYY-MM-DD" or "DD.MM.YYYY - DD.MM.YYYY"
  m = raw.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\s*[-–—]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})/);
  if (m) {
    const d1 = findFirstDate(m[1]);
    const d2 = findFirstDate(m[2]);
    if (d1 && d2) {
      const a = startOfUtcDay(d1);
      const b = endOfUtcDay(d2);
      const from = a <= b ? a : startOfUtcDay(d2);
      const to = a <= b ? b : endOfUtcDay(d1);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc), confidence: 0.8 };
    }
  }

  return null;
}

function parseSingleDate(textNorm, nowUtc) {
  const d = findFirstDate(textNorm);
  if (!d) return null;
  const from = startOfUtcDay(d);
  const to = endOfUtcDay(d);
  return { type: "day", ...clampFutureToNowEnd(from, to, nowUtc), confidence: 0.8 };
}

/**
 * Parse a recall date/period intent from free text.
 *
 * @returns {{
 *   type: "none"|"day"|"range",
 *   from?: Date,
 *   to?: Date,
 *   confidence: number,
 *   normalized?: { fromIso: string, toIso: string },
 *   note?: string
 * }}
 */
export function parseDatePeriod(text, nowUtc = new Date()) {
  const t = norm(text);

  if (!t) return { type: "none", confidence: 0.0 };

  // 1) explicit ranges first (strong intent)
  const rng = parseExplicitRange(t, nowUtc);
  if (rng) {
    return {
      ...rng,
      normalized: {
        fromIso: `${rng.from.getUTCFullYear()}-${pad2(rng.from.getUTCMonth() + 1)}-${pad2(
          rng.from.getUTCDate()
        )}`,
        toIso: `${rng.to.getUTCFullYear()}-${pad2(rng.to.getUTCMonth() + 1)}-${pad2(rng.to.getUTCDate())}`,
      },
    };
  }

  // 2) relative days / last N days
  const rel = parseRelativeDay(t, nowUtc);
  if (rel) {
    return {
      ...rel,
      normalized: {
        fromIso: `${rel.from.getUTCFullYear()}-${pad2(rel.from.getUTCMonth() + 1)}-${pad2(rel.from.getUTCDate())}`,
        toIso: `${rel.to.getUTCFullYear()}-${pad2(rel.to.getUTCMonth() + 1)}-${pad2(rel.to.getUTCDate())}`,
      },
    };
  }

  // 3) single date
  const one = parseSingleDate(t, nowUtc);
  if (one) {
    return {
      ...one,
      normalized: {
        fromIso: `${one.from.getUTCFullYear()}-${pad2(one.from.getUTCMonth() + 1)}-${pad2(one.from.getUTCDate())}`,
        toIso: `${one.to.getUTCFullYear()}-${pad2(one.to.getUTCMonth() + 1)}-${pad2(one.to.getUTCDate())}`,
      },
    };
  }

  return { type: "none", confidence: 0.0 };
}

export default parseDatePeriod;
