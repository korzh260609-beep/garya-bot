// src/core/time/TimeContext.js
// STAGE 8 — Time Architecture Skeleton
// Goal: centralize ALL time logic (UTC internal, user TZ external)

export class TimeContext {
  constructor({ userTimezone = "UTC" }) {
    this.userTimezone = userTimezone;
  }

  // Always system-UTC "now"
  nowUTC() {
    return new Date();
  }

  // Convert user-relative date expression → { fromUTC, toUTC, hint }
  parseHumanDate(query) {
    // TODO: implement in next step
    return null;
  }

  // Convert UTC date to user display timezone
  formatForUser(dateUTC) {
    // TODO: implement in next step
    return null;
  }

  // Normalize start of day in USER timezone, return UTC boundary
  startOfUserDayUTC(date) {
    // TODO
    return null;
  }

  // Normalize week start (user TZ), return UTC boundary
  startOfUserWeekUTC(date) {
    // TODO
    return null;
  }
}
