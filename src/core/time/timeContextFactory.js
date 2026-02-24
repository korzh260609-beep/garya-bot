// src/core/time/timeContextFactory.js
// STAGE 8 — TimeContext Factory (no DB yet)

import { TimeContext } from "./TimeContext.js";
import { resolveUserTimezone } from "./timezoneResolver.js";

export function createTimeContext({ userTimezoneFromDb = null } = {}) {
  const tz = resolveUserTimezone({ userTimezoneFromDb });
  return new TimeContext({ userTimezone: tz });
}
