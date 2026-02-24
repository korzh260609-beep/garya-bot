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
    return new Date();
  }

  // --- helpers ---

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

  // --- main date parser (UTC output only) ---

  parseHumanDate(query) {
    try {
      const q = String(query || "").toLowerCase();
      const now = this.nowUTC();

      // LAST WEEK
      if (
        /\blast\s+week\b/.test(q) ||
        q.includes("прошлой неделе") ||
        q.includes("минулого тижня")
      ) {
        const thisWeekStart = this.startOfUTCWeekMonday(now);
        const from = this.addDaysUTC(thisWeekStart, -7);
        const to = thisWeekStart;
        return { fromUTC: from, toUTC: to, hint: "last_week" };
      }

      // TODAY
      if (q.includes("сегодня") || q.includes("сьогодні") || /\btoday\b/.test(q)) {
        const from = this.startOfUTCDay(now);
        const to = this.startOfUTCDay(this.addDaysUTC(now, 1));
        return { fromUTC: from, toUTC: to, hint: "today" };
      }

      // TOMORROW
      if (q.includes("завтра") || /\btomorrow\b/.test(q)) {
        const from = this.startOfUTCDay(this.addDaysUTC(now, 1));
        const to = this.startOfUTCDay(this.addDaysUTC(now, 2));
        return { fromUTC: from, toUTC: to, hint: "tomorrow" };
      }

      // DAY BEFORE YESTERDAY
      if (
        q.includes("позавчера") ||
        q.includes("позавчора") ||
        /\bday\s+before\s+yesterday\b/.test(q)
      ) {
        const from = this.startOfUTCDay(this.addDaysUTC(now, -2));
        const to = this.startOfUTCDay(this.addDaysUTC(now, -1));
        return { fromUTC: from, toUTC: to, hint: "day_before_yesterday" };
      }

      // YESTERDAY
      if (q.includes("вчера") || q.includes("вчора") || /\byesterday\b/.test(q)) {
        const from = this.startOfUTCDay(this.addDaysUTC(now, -1));
        const to = this.startOfUTCDay(now);
        return { fromUTC: from, toUTC: to, hint: "yesterday" };
      }

      // LAST N DAYS (includes today)
      // examples: "последние 3 дня", "за последние 7 дней", "last 3 days"
      let lastN = q.match(/(?:за\s+)?последн(?:ие|их)\s*(\d{1,2})\s*(?:дн(?:я|ей)|дні|днів)/iu);
      if (!lastN) {
        lastN = q.match(/\blast\s+(\d{1,2})\s+days?\b/i);
      }
      if (lastN && lastN[1]) {
        const n = Math.max(1, Math.min(30, Number(lastN[1])));
        const todayStart = this.startOfUTCDay(now);
        const from = this.startOfUTCDay(this.addDaysUTC(todayStart, -(n - 1)));
        const to = this.startOfUTCDay(this.addDaysUTC(todayStart, 1));
        return { fromUTC: from, toUTC: to, hint: `last_${n}_days` };
      }

      // N days ago (EN)
      let m = q.match(/\b(\d{1,2})\s*days?\s*ago\b/);
      if (m && m[1]) {
        const n = Math.max(0, Math.min(30, Number(m[1])));
        const from = this.startOfUTCDay(this.addDaysUTC(now, -n));
        const to = this.startOfUTCDay(this.addDaysUTC(now, -n + 1));
        return { fromUTC: from, toUTC: to, hint: `${n}_days_ago` };
      }

      // N days ago (RU/UA)
      m = q.match(/(\d{1,2})\s*(дн(?:ей|я)|дні|днів)\s*назад/iu);
      if (m && m[1]) {
        const n = Math.max(0, Math.min(30, Number(m[1])));
        const from = this.startOfUTCDay(this.addDaysUTC(now, -n));
        const to = this.startOfUTCDay(this.addDaysUTC(now, -n + 1));
        return { fromUTC: from, toUTC: to, hint: `${n}_days_ago` };
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  // --- display formatter ---

  formatForUser(dateUTC) {
    try {
      return new Intl.DateTimeFormat("uk-UA", {
        timeZone: this.userTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(dateUTC);
    } catch (_) {
      return null;
    }
  }
}
