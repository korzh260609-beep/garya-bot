// src/core/time/TimeContext.js
// STAGE 8 — Time Architecture
// Centralized time logic
// Internal = UTC
// External = user timezone

export class TimeContext {
  constructor({ userTimezone = "UTC" }) {
    this.userTimezone = userTimezone || "UTC";
  }

  nowUTC() {
    // Date object is an instant in time (UTC-based internally)
    return new Date();
  }

  // --- helpers ---

  // NOTE: These UTC helpers are kept for backward compatibility / internal use.
  startOfUTCDay(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  addDaysUTC(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + Number(days || 0));
    return d;
  }

  startOfUTCWeekMonday(date) {
    const dayStart = this.startOfUTCDay(date);
    const dow = dayStart.getUTCDay(); // 0=Sun
    const delta = (dow + 6) % 7; // Monday-based
    return this.addDaysUTC(dayStart, -delta);
  }

  // --- internal: safe timezone (fallback to UTC on invalid TZ) ---

  _safeTimeZoneOrUTC(tz) {
    const cand = String(tz || "").trim() || "UTC";
    if (cand === "UTC") return "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: cand }).format(new Date());
      return cand;
    } catch (_) {
      return "UTC";
    }
  }

  _tz() {
    return this._safeTimeZoneOrUTC(this.userTimezone);
  }

  _monthMapRuUa() {
    return {
      января: 0,
      січня: 0,

      февраля: 1,
      лютого: 1,

      марта: 2,
      березня: 2,

      апреля: 3,
      квітня: 3,

      мая: 4,
      травня: 4,

      июня: 5,
      червня: 5,

      июля: 6,
      липня: 6,

      августа: 7,
      серпня: 7,

      сентября: 8,
      вересня: 8,

      октября: 9,
      жовтня: 9,

      ноября: 10,
      листопада: 10,

      декабря: 11,
      грудня: 11,
    };
  }

  _monthMapEn() {
    return {
      january: 0,
      jan: 0,

      february: 1,
      feb: 1,

      march: 2,
      mar: 2,

      april: 3,
      apr: 3,

      may: 4,

      june: 5,
      jun: 5,

      july: 6,
      jul: 6,

      august: 7,
      aug: 7,

      september: 8,
      sep: 8,
      sept: 8,

      october: 9,
      oct: 9,

      november: 10,
      nov: 10,

      december: 11,
      dec: 11,
    };
  }

  _isValidDayMonth(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
    if (month < 0 || month > 11) return false;
    if (day < 1 || day > 31) return false;

    const d = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    return (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month &&
      d.getUTCDate() === day
    );
  }

  _buildSingleDayRange(year, month, day) {
    if (!this._isValidDayMonth(year, month, day)) return null;

    const candidate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    const from = this.startOfUserDayUTC(candidate);
    const to = this.addDaysUser(from, 1);

    return { fromUTC: from, toUTC: to };
  }

  _resolveYearForSingleDay(month, day, nowUTC) {
    const nowParts = this.getZonedParts(nowUTC);
    let year = nowParts.year;

    const currentYearRange = this._buildSingleDayRange(year, month, day);
    if (!currentYearRange) return null;

    const tomorrowStart = this.addDaysUser(nowUTC, 1);

    if (currentYearRange.fromUTC.getTime() >= tomorrowStart.getTime()) {
      year -= 1;
    }

    return year;
  }

  _resolveExplicitDayMonth(query, nowUTC) {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return null;

    const ruUa = this._monthMapRuUa();
    const en = this._monthMapEn();

    // RU/UA: "11 марта", "5 квітня"
    let m = q.match(
      /\b(\d{1,2})\s+(января|січня|февраля|лютого|марта|березня|апреля|квітня|мая|травня|июня|червня|июля|липня|августа|серпня|сентября|вересня|октября|жовтня|ноября|листопада|декабря|грудня)\b/iu
    );

    if (m) {
      const day = Number(m[1]);
      const monthName = String(m[2] || "").toLowerCase();
      const month = ruUa[monthName];

      if (Number.isInteger(day) && day >= 1 && day <= 31 && Number.isInteger(month)) {
        const year = this._resolveYearForSingleDay(month, day, nowUTC);
        if (year == null) return null;

        const range = this._buildSingleDayRange(year, month, day);
        if (!range) return null;

        return { ...range, hint: `explicit_${day}_${month + 1}` };
      }
    }

    // EN: "march 11", "mar 11"
    m = q.match(
      /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})\b/i
    );

    if (m) {
      const monthName = String(m[1] || "").toLowerCase();
      const day = Number(m[2]);
      const month = en[monthName];

      if (Number.isInteger(day) && day >= 1 && day <= 31 && Number.isInteger(month)) {
        const year = this._resolveYearForSingleDay(month, day, nowUTC);
        if (year == null) return null;

        const range = this._buildSingleDayRange(year, month, day);
        if (!range) return null;

        return { ...range, hint: `explicit_${day}_${month + 1}` };
      }
    }

    // EN: "11 march", "11 mar"
    m = q.match(
      /\b(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/i
    );

    if (m) {
      const day = Number(m[1]);
      const monthName = String(m[2] || "").toLowerCase();
      const month = en[monthName];

      if (Number.isInteger(day) && day >= 1 && day <= 31 && Number.isInteger(month)) {
        const year = this._resolveYearForSingleDay(month, day, nowUTC);
        if (year == null) return null;

        const range = this._buildSingleDayRange(year, month, day);
        if (!range) return null;

        return { ...range, hint: `explicit_${day}_${month + 1}` };
      }
    }

    return null;
  }

  _resolveExplicitRange(query, nowUTC) {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return null;

    const ruUa = this._monthMapRuUa();
    const en = this._monthMapEn();

    // RU/UA:
    // "с 8 по 13 марта"
    // "с 8 марта по 13 марта"
    // "8-13 марта"
    let m = q.match(
      /\b(?:с\s*)?(\d{1,2})\s*(?:(января|січня|февраля|лютого|марта|березня|апреля|квітня|мая|травня|июня|червня|июля|липня|августа|серпня|сентября|вересня|октября|жовтня|ноября|листопада|декабря|грудня)\s*)?(?:по|-)\s*(\d{1,2})\s*(января|січня|февраля|лютого|марта|березня|апреля|квітня|мая|травня|июня|червня|июля|липня|августа|серпня|сентября|вересня|октября|жовтня|ноября|листопада|декабря|грудня)\b/iu
    );

    if (m) {
      const dayFrom = Number(m[1]);
      const firstMonthName = m[2] ? String(m[2]).toLowerCase() : null;
      const dayTo = Number(m[3]);
      const secondMonthName = String(m[4] || "").toLowerCase();

      const monthTo = ruUa[secondMonthName];
      const monthFrom = firstMonthName ? ruUa[firstMonthName] : monthTo;

      if (
        Number.isInteger(dayFrom) &&
        Number.isInteger(dayTo) &&
        Number.isInteger(monthFrom) &&
        Number.isInteger(monthTo)
      ) {
        const nowParts = this.getZonedParts(nowUTC);
        let yearFrom = nowParts.year;
        let yearTo = nowParts.year;

        // cross-year only if month order clearly wraps
        if (monthFrom > monthTo) {
          yearFrom -= 1;
        }

        if (!this._isValidDayMonth(yearFrom, monthFrom, dayFrom)) return null;
        if (!this._isValidDayMonth(yearTo, monthTo, dayTo)) return null;

        let fromRange = this._buildSingleDayRange(yearFrom, monthFrom, dayFrom);
        let toRange = this._buildSingleDayRange(yearTo, monthTo, dayTo);
        if (!fromRange || !toRange) return null;

        if (fromRange.fromUTC.getTime() > toRange.fromUTC.getTime()) {
          // fallback to previous year for both if range ended up in future/backwards
          yearFrom -= 1;
          yearTo -= 1;

          if (!this._isValidDayMonth(yearFrom, monthFrom, dayFrom)) return null;
          if (!this._isValidDayMonth(yearTo, monthTo, dayTo)) return null;

          fromRange = this._buildSingleDayRange(yearFrom, monthFrom, dayFrom);
          toRange = this._buildSingleDayRange(yearTo, monthTo, dayTo);
          if (!fromRange || !toRange) return null;
        }

        const tomorrowStart = this.addDaysUser(nowUTC, 1);
        if (fromRange.fromUTC.getTime() >= tomorrowStart.getTime()) {
          yearFrom -= 1;
          yearTo -= 1;

          if (!this._isValidDayMonth(yearFrom, monthFrom, dayFrom)) return null;
          if (!this._isValidDayMonth(yearTo, monthTo, dayTo)) return null;

          fromRange = this._buildSingleDayRange(yearFrom, monthFrom, dayFrom);
          toRange = this._buildSingleDayRange(yearTo, monthTo, dayTo);
          if (!fromRange || !toRange) return null;
        }

        return {
          fromUTC: fromRange.fromUTC,
          toUTC: toRange.toUTC,
          hint: `explicit_range_${dayFrom}_${monthFrom + 1}_${dayTo}_${monthTo + 1}`,
        };
      }
    }

    // EN:
    // "between 8 and 13 march"
    // "from 8 to 13 march"
    // "8-13 march"
    m = q.match(
      /\b(?:between|from)?\s*(\d{1,2})\s*(?:and|to|-)\s*(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/i
    );

    if (m) {
      const dayFrom = Number(m[1]);
      const dayTo = Number(m[2]);
      const monthName = String(m[3] || "").toLowerCase();
      const month = en[monthName];

      if (Number.isInteger(dayFrom) && Number.isInteger(dayTo) && Number.isInteger(month)) {
        const nowParts = this.getZonedParts(nowUTC);
        let year = nowParts.year;

        if (!this._isValidDayMonth(year, month, dayFrom)) return null;
        if (!this._isValidDayMonth(year, month, dayTo)) return null;

        let fromRange = this._buildSingleDayRange(year, month, dayFrom);
        let toRange = this._buildSingleDayRange(year, month, dayTo);
        if (!fromRange || !toRange) return null;

        if (fromRange.fromUTC.getTime() > toRange.fromUTC.getTime()) {
          return null;
        }

        const tomorrowStart = this.addDaysUser(nowUTC, 1);
        if (fromRange.fromUTC.getTime() >= tomorrowStart.getTime()) {
          year -= 1;

          if (!this._isValidDayMonth(year, month, dayFrom)) return null;
          if (!this._isValidDayMonth(year, month, dayTo)) return null;

          fromRange = this._buildSingleDayRange(year, month, dayFrom);
          toRange = this._buildSingleDayRange(year, month, dayTo);
          if (!fromRange || !toRange) return null;
        }

        return {
          fromUTC: fromRange.fromUTC,
          toUTC: toRange.toUTC,
          hint: `explicit_range_${dayFrom}_${month + 1}_${dayTo}_${month + 1}`,
        };
      }
    }

    return null;
  }

  // --- timezone-safe helpers (USER TZ -> UTC instants) ---

  getZonedParts(dateUTC) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: this._tz(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(dateUTC);

    const get = (type) => parts.find((p) => p.type === type)?.value;

    return {
      year: Number(get("year")),
      month: Number(get("month")),
      day: Number(get("day")),
      hour: Number(get("hour")),
      minute: Number(get("minute")),
      second: Number(get("second")),
    };
  }

  // Start of day in USER timezone, returned as UTC Date (instant)
  startOfUserDayUTC(dateUTC) {
    const { year, month, day } = this.getZonedParts(dateUTC);

    let candidate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    for (let i = 0; i < 2; i++) {
      const p = this.getZonedParts(candidate);
      const deltaMinutes = (p.hour || 0) * 60 + (p.minute || 0);
      candidate = new Date(candidate.getTime() - deltaMinutes * 60 * 1000);

      const check = this.getZonedParts(candidate);
      if (
        check.year === year &&
        check.month === month &&
        check.day === day &&
        check.hour === 0 &&
        check.minute === 0
      ) {
        break;
      }
    }

    return candidate;
  }

  // Add days in USER timezone (returns start-of-day in UTC for the target user-day)
  addDaysUser(dateUTC, days) {
    const baseStart = this.startOfUserDayUTC(dateUTC);
    const { year, month, day } = this.getZonedParts(baseStart);

    const shifted = new Date(Date.UTC(year, month - 1, day + Number(days || 0), 12, 0, 0, 0));

    return this.startOfUserDayUTC(shifted);
  }

  startOfUserWeekMondayUTC(dateUTC) {
    const dayStart = this.startOfUserDayUTC(dateUTC);

    const w = new Intl.DateTimeFormat("en-US", {
      timeZone: this._tz(),
      weekday: "short",
    }).format(dayStart);

    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const dow = map[w] || 1;
    const delta = dow - 1;

    return this.addDaysUser(dayStart, -delta);
  }

  // --- main date parser (UTC output only) ---

  parseHumanDate(query) {
    try {
      const q = String(query || "").toLowerCase();
      const now = this.nowUTC();

      // LAST WEEK (user TZ week boundaries)
      if (/\blast\s+week\b/.test(q) || q.includes("прошлой неделе") || q.includes("минулого тижня")) {
        const thisWeekStart = this.startOfUserWeekMondayUTC(now);
        const from = this.addDaysUser(thisWeekStart, -7);
        const to = thisWeekStart;
        return { fromUTC: from, toUTC: to, hint: "last_week" };
      }

      // TODAY (user TZ day boundaries)
      if (q.includes("сегодня") || q.includes("сьогодні") || /\btoday\b/.test(q)) {
        const from = this.startOfUserDayUTC(now);
        const to = this.addDaysUser(from, 1);
        return { fromUTC: from, toUTC: to, hint: "today" };
      }

      // TOMORROW
      if (q.includes("завтра") || /\btomorrow\b/.test(q)) {
        const from = this.addDaysUser(now, 1);
        const to = this.addDaysUser(now, 2);
        return { fromUTC: from, toUTC: to, hint: "tomorrow" };
      }

      // DAY BEFORE YESTERDAY
      if (q.includes("позавчера") || q.includes("позавчора") || /\bday\s+before\s+yesterday\b/.test(q)) {
        const from = this.addDaysUser(now, -2);
        const to = this.addDaysUser(now, -1);
        return { fromUTC: from, toUTC: to, hint: "day_before_yesterday" };
      }

      // YESTERDAY
      if (q.includes("вчера") || q.includes("вчора") || /\byesterday\b/.test(q)) {
        const from = this.addDaysUser(now, -1);
        const to = this.startOfUserDayUTC(now);
        return { fromUTC: from, toUTC: to, hint: "yesterday" };
      }

      // EXPLICIT RANGE
      // examples: "с 8 по 13 марта", "с 8 марта по 13 марта", "between 8 and 13 march"
      const explicitRange = this._resolveExplicitRange(q, now);
      if (explicitRange) {
        return explicitRange;
      }

      // EXPLICIT DAY + MONTH
      // examples: "11 марта", "5 апреля", "march 11", "11 march"
      const explicitDate = this._resolveExplicitDayMonth(q, now);
      if (explicitDate) {
        return explicitDate;
      }

      // LAST N DAYS (includes today) — user TZ
      let lastN = q.match(/(?:за\s+)?последн(?:ие|их)\s*(\d{1,2})\s*(?:дн(?:я|ей)|дні|днів)/iu);
      if (!lastN) {
        lastN = q.match(/\blast\s+(\d{1,2})\s+days?\b/i);
      }
      if (lastN && lastN[1]) {
        const n = Math.max(1, Math.min(30, Number(lastN[1])));
        const todayStart = this.startOfUserDayUTC(now);
        const from = this.addDaysUser(todayStart, -(n - 1));
        const to = this.addDaysUser(todayStart, 1);
        return { fromUTC: from, toUTC: to, hint: `last_${n}_days` };
      }

      // WEEK AGO (single day)
      if (q.includes("неделю назад") || q.includes("тиждень тому") || /\ba\s+week\s+ago\b/.test(q)) {
        const from = this.addDaysUser(now, -7);
        const to = this.addDaysUser(now, -6);
        return { fromUTC: from, toUTC: to, hint: "7_days_ago" };
      }

      // N days ago (EN)
      let m = q.match(/\b(\d{1,2})\s*days?\s*ago\b/);
      if (m && m[1]) {
        const n = Math.max(0, Math.min(30, Number(m[1])));
        const from = this.addDaysUser(now, -n);
        const to = this.addDaysUser(now, -n + 1);
        return { fromUTC: from, toUTC: to, hint: `${n}_days_ago` };
      }

      // N days ago (RU/UA)
      m = q.match(/(\d{1,2})\s*(дн(?:ей|я)|дні|днів)\s*назад/iu);
      if (m && m[1]) {
        const n = Math.max(0, Math.min(30, Number(m[1])));
        const from = this.addDaysUser(now, -n);
        const to = this.addDaysUser(now, -n + 1);
        return { fromUTC: from, toUTC: to, hint: `${n}_days_ago` };
      }

      // IN N DAYS / ЧЕРЕЗ N ДНЕЙ (future single day) — user TZ
      let futureN = q.match(/через\s+(\d{1,2})\s*(дн(?:я|ей)|дні|днів)/iu);
      if (!futureN) {
        futureN = q.match(/\bin\s+(\d{1,2})\s+days?\b/i);
      }
      if (futureN && futureN[1]) {
        const n = Math.max(0, Math.min(30, Number(futureN[1])));
        const from = this.addDaysUser(now, n);
        const to = this.addDaysUser(now, n + 1);
        return { fromUTC: from, toUTC: to, hint: `${n}_days_from_now` };
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  // --- display formatter ---

  // STAGE 8A.1 — date-only formatter (user timezone)
  formatDateForUser(dateUTC) {
    try {
      return new Intl.DateTimeFormat("uk-UA", {
        timeZone: this._tz(),
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dateUTC);
    } catch (_) {
      try {
        return new Intl.DateTimeFormat("uk-UA", {
          timeZone: "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(dateUTC);
      } catch (__2) {
        return null;
      }
    }
  }

  formatForUser(dateUTC) {
    try {
      return new Intl.DateTimeFormat("uk-UA", {
        timeZone: this._tz(),
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(dateUTC);
    } catch (_) {
      try {
        return new Intl.DateTimeFormat("uk-UA", {
          timeZone: "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(dateUTC);
      } catch (__2) {
        return null;
      }
    }
  }
}