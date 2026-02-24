// src/core/time/timezoneResolver.js
// STAGE 8 — Timezone Resolver Skeleton
// No DB usage yet. Pure fallback logic.

export function resolveUserTimezone({ userTimezoneFromDb }) {
  if (userTimezoneFromDb && typeof userTimezoneFromDb === "string") {
    return userTimezoneFromDb;
  }

  return process.env.DEFAULT_TIMEZONE || "UTC";
}
