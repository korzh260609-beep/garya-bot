// src/core/time/timezoneResolver.js
// STAGE 8 — Timezone Resolver Skeleton
// Pure fallback logic + validation (fail-open).
//
// ✅ FIX: validate IANA timezone; fallback to DEFAULT_TIMEZONE / UTC if invalid.
// Reason: invalid timezone in DB makes Intl.DateTimeFormat throw -> deterministic time returns null -> AI called.

function isValidIanaTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch (_) {
    return false;
  }
}

export function resolveUserTimezone({ userTimezoneFromDb }) {
  const fallback = process.env.DEFAULT_TIMEZONE || "UTC";

  if (userTimezoneFromDb && typeof userTimezoneFromDb === "string") {
    const tz = userTimezoneFromDb.trim();
    if (tz && isValidIanaTimezone(tz)) return tz;
    return fallback;
  }

  if (fallback && isValidIanaTimezone(fallback)) return fallback;
  return "UTC";
}