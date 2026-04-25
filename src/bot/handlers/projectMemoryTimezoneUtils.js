// src/bot/handlers/projectMemoryTimezoneUtils.js
// ============================================================================
// Project Memory timezone utilities
// Purpose:
// - keep repeated display-timezone resolution out of Project Memory handlers
// - preserve existing fail-open behavior
// - DB read only
// - no writes
// ============================================================================

import { getUserTimezone } from "../../db/userSettings.js";
import { resolveUserTimezone } from "../../core/time/timezoneResolver.js";
import { safeText } from "./projectMemoryReadRenderUtils.js";

export async function resolveProjectMemoryDisplayTimezone(globalUserId) {
  let userTimezoneFromDb = null;

  try {
    if (globalUserId) {
      const tzInfo = await getUserTimezone(globalUserId);
      if (tzInfo?.isSet === true && safeText(tzInfo.timezone)) {
        userTimezoneFromDb = safeText(tzInfo.timezone);
      }
    }
  } catch (_) {
    // fail-open
  }

  try {
    return resolveUserTimezone({ userTimezoneFromDb });
  } catch (_) {
    return "UTC";
  }
}

export default {
  resolveProjectMemoryDisplayTimezone,
};
