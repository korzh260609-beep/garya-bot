// src/core/recall/datePeriodParser.js
// STAGE 8A.1 — Date/period parser (MVP, no external deps)
// Purpose: parse user text into a recall time window.
//
// KYIV TIME CHANGE (requested):
// - Day boundaries are computed in Europe/Kyiv timezone, then converted to UTC Date objects.
// - Conservative parsing: if unsure → returns type:"none".
// - Future steps will wire this into RecallEngine.recall().

const DEFAULT_TZ = String(process.env.RECALL_TZ || "Europe/Kyiv").trim() || "Europe/Kyiv";

function toInt(x) {
  const n = Number.parseInt(String(x), 10);
  return Number.isFinite(n) ? n : null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getTzParts(date, timeZone) {
  // Returns numeric parts as seen in the target timeZone
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  return {
    year: toInt(map.year),
    month: toInt(map.month),
    day: toInt(map.day),
    hour: toInt(map.hour),
    minute: toInt(map.minute),
    second: toInt(map.second),
  };
}

function getTzOffsetMinutes(date, timeZone) {
  // Offset = (zoned-as-UTC - actual-UTC) in minutes
  const p = getTzParts(date, timeZone);
  if (!p.year || !p.month || !p.day) return 0;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour || 0, p.minute || 0, p.second || 0);
  return (asUtc - date.getTime()) / 60000;
}

function zonedTimeToUtcDate({ year, month, day, hour, minute, second, ms = 0 }, timeZone) {
  // 1-iteration conversion is enough for our use (midnight boundaries).
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offsetMin = getTzOffsetMinutes(guess, timeZone);
  const corrected = new Date(guess.getTime() - offsetMin * 60000);
  // Re-check once to stabilize around DST boundaries
  const offset2 = getTzOffsetMinutes(corrected, timeZone);
  if (offset2 !== offsetMin) {
    return new Date(guess.getTime() - offset2 * 60000);
  }
  return corrected;
}

function startOfDayInTz(date, timeZone) {
  const p = getTzParts(date, timeZone);
  return zonedTimeToUtcDate(
    { year: p.year, month: p.month, day: p.day, hour: 0, minute: 0, second: 0, ms: 0 },
    timeZone
  );
}

function endOfDayInTz(date, timeZone) {
  const p = getTzParts(date, timeZone);
  // 23:59:59.999 local
  return zonedTimeToUtcDate(
    { year: p.year, month: p.month, day: p.day, hour: 23, minute: 59, second: 59, ms: 999 },
    timeZone
  );
}

function addDaysInTz(date, days, timeZone) {
  // Add days by moving via local day start to avoid DST pitfalls
  const start = startOfDayInTz(date, timeZone);
  const moved = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  // Return a date that still points to the target local day (safe at noon local)
  const p = getTzParts(moved, timeZone);
  return zonedTimeToUtcDate(
    { year: p.year, month: p.month, day: p.day, hour: 12, minute: 0, second: 0, ms: 0 },
    timeZone
  );
}

function clampFutureToNowEnd(from, to, nowUtc = new Date(), timeZone = DEFAULT_TZ) {
  const nowEnd = endOfDayInTz(nowUtc, timeZone);
  const clampedTo = to > nowEnd ? nowEnd : to;
  const clampedFrom = from > nowEnd ? nowEnd : from;
  return { from: clampedFrom, to: clampedTo };
}

function parseIsoDateYYYYMMDD(s) {
  // YYYY-MM-DD
  const m = String(s || "").match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (!m) return null;
  const y = toInt(m[1]);
  const mo = toInt(m[2]);
  const d = toInt(m[3]);
  if (!y || !mo || !d) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  // Create UTC date at noon to validate the calendar date
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

function parseDotOrSlashDateDDMMYYYY(s) {
  // DD.MM.YYYY or DD/MM/YYYY
  const m = String(s || "").match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
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

function parseRelativeDay(textNorm, nowUtc, timeZone) {
  if (!textNorm) return null;

  const todayRe = /\b(today|сегодня|сьогодні)\b/;
  const yesterdayRe = /\b(yesterday|вчера|вчора)\b/;
  const beforeYesterdayRe = /\b(day before yesterday|позавчера|позавчора)\b/;

  if (beforeYesterdayRe.test(textNorm)) {
    const d = addDaysInTz(nowUtc, -2, timeZone);
    return { type: "day", from: startOfDayInTz(d, timeZone), to: endOfDayInTz(d, timeZone), confidence: 0.9 };
  }
  if (yesterdayRe.test(textNorm)) {
    const d = addDaysInTz(nowUtc, -1, timeZone);
    return { type: "day", from: startOfDayInTz(d, timeZone), to: endOfDayInTz(d, timeZone), confidence: 0.9 };
  }
  if (todayRe.test(textNorm)) {
    const d = addDaysInTz(nowUtc, 0, timeZone);
    return { type: "day", from: startOfDayInTz(d, timeZone), to: endOfDayInTz(d, timeZone), confidence: 0.9 };
  }

  // last/past N days (range)
  const lastDays =
    textNorm.match(/\b(last|past)\s+(\d{1,3})\s+days?\b/) ||
    textNorm.match(/\bза\s+(\d{1,3})\s+(днів|дня|день|дней|дня|день)\b/) ||
    textNorm.match(/\b(\d{1,3})\s*d\b/);

  if (lastDays) {
    const n =
      toInt(lastDays[2]) ??
      toInt(lastDays[1]) ??
      toInt(lastDays[0]?.match(/(\d{1,3})/)?.[1]);
    if (n && n >= 1 && n <= 365) {
      const to = endOfDayInTz(nowUtc, timeZone);
      const fromBase = addDaysInTz(nowUtc, -(n - 1), timeZone);
      const from = startOfDayInTz(fromBase, timeZone);
      return { type: "range", from, to, confidence: 0.75 };
    }
  }

  return null;
}

function parseExplicitRange(textNorm, nowUtc, timeZone) {
  const raw = textNorm;

  // between ... and ...
  let m = raw.match(/\bbetween\s+(.+?)\s+and\s+(.+)\b/);
  if (m) {
    const d1 = findFirstDate(m[1]);
    const d2 = findFirstDate(m[2]);
    if (d1 && d2) {
      const a = startOfDayInTz(d1, timeZone);
      const b = endOfDayInTz(d2, timeZone);
      const from = a <= b ? a : startOfDayInTz(d2, timeZone);
      const to = a <= b ? b : endOfDayInTz(d1, timeZone);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc, timeZone), confidence: 0.85 };
    }
  }

  // from ... to ...
  m = raw.match(/\bfrom\s+(.+?)\s+to\s+(.+)\b/);
  if (m) {
    const d1 = findFirstDate(m[1]);
    const d2 = findFirstDate(m[2]);
    if (d1 && d2) {
      const a = startOfDayInTz(d1, timeZone);
      const b = endOfDayInTz(d2, timeZone);
      const from = a <= b ? a : startOfDayInTz(d2, timeZone);
      const to = a <= b ? b : endOfDayInTz(d1, timeZone);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc, timeZone), confidence: 0.85 };
    }
  }

  // з ... по ... / c ... по ...
  m = raw.match(/\b(з|с)\s+(.+?)\s+по\s+(.+)\b/);
  if (m) {
    const d1 = findFirstDate(m[2]);
    const d2 = findFirstDate(m[3]);
    if (d1 && d2) {
      const a = startOfDayInTz(d1, timeZone);
      const b = endOfDayInTz(d2, timeZone);
      const from = a <= b ? a : startOfDayInTz(d2, timeZone);
      const to = a <= b ? b : endOfDayInTz(d1, timeZone);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc, timeZone), confidence: 0.85 };
    }
  }

  // "date - date"
  m = raw.match(
    /(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})\s*[-–—]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4})/
  );
  if (m) {
    const d1 = findFirstDate(m[1]);
    const d2 = findFirstDate(m[2]);
    if (d1 && d2) {
      const a = startOfDayInTz(d1, timeZone);
      const b = endOfDayInTz(d2, timeZone);
      const from = a <= b ? a : startOfDayInTz(d2, timeZone);
      const to = a <= b ? b : endOfDayInTz(d1, timeZone);
      return { type: "range", ...clampFutureToNowEnd(from, to, nowUtc, timeZone), confidence: 0.8 };
    }
  }

  return null;
}

function parseSingleDate(textNorm, nowUtc, timeZone) {
  const d = findFirstDate(textNorm);
  if (!d) return null;
  const from = startOfDayInTz(d, timeZone);
  const to = endOfDayInTz(d, timeZone);
  return { type: "day", ...clampFutureToNowEnd(from, to, nowUtc, timeZone), confidence: 0.8 };
}

/**
 * Parse a recall date/period intent from free text.
 *
 * Returns UTC Date objects that correspond to Kyiv-local day boundaries.
 */
export function parseDatePeriod(text, nowUtc = new Date(), timeZone = DEFAULT_TZ) {
  const t = norm(text);

  if (!t) return { type: "none", confidence: 0.0 };

  const rng = parseExplicitRange(t, nowUtc, timeZone);
  if (rng) {
    return {
      ...rng,
      normalized: {
        fromIso: `${rng.from.getUTCFullYear()}-${pad2(rng.from.getUTCMonth() + 1)}-${pad2(rng.from.getUTCDate())}`,
        toIso: `${rng.to.getUTCFullYear()}-${pad2(rng.to.getUTCMonth() + 1)}-${pad2(rng.to.getUTCDate())}`,
      },
    };
  }

  const rel = parseRelativeDay(t, nowUtc, timeZone);
  if (rel) {
    return {
      ...rel,
      normalized: {
        fromIso: `${rel.from.getUTCFullYear()}-${pad2(rel.from.getUTCMonth() + 1)}-${pad2(rel.from.getUTCDate())}`,
        toIso: `${rel.to.getUTCFullYear()}-${pad2(rel.to.getUTCMonth() + 1)}-${pad2(rel.to.getUTCDate())}`,
      },
    };
  }

  const one = parseSingleDate(t, nowUtc, timeZone);
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
