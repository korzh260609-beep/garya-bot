// src/db/userSettings.js
// STAGE 8C (timezone groundwork)
// DB-layer only. No business logic here.

import pool from "../../db.js";

/**
 * Get timezone info for user.
 * Returns:
 * {
 *   timezone: string,
 *   isSet: boolean
 * }
 */
export async function getUserTimezone(globalUserId) {
  if (!globalUserId) {
    return { timezone: "UTC", isSet: false };
  }

  const r = await pool.query(
    `
    SELECT timezone, timezone_is_set
    FROM user_settings
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [String(globalUserId)]
  );

  if (r.rowCount === 0) {
    return { timezone: "UTC", isSet: false };
  }

  return {
    timezone: r.rows[0].timezone || "UTC",
    isSet: r.rows[0].timezone_is_set === true,
  };
}

/**
 * Set or update timezone (IANA string).
 * Marks timezone as explicitly set by user.
 */
export async function setUserTimezone(globalUserId, timezone) {
  if (!globalUserId) return;

  await pool.query(
    `
    INSERT INTO user_settings (global_user_id, timezone, timezone_is_set, updated_at)
    VALUES ($1, $2, true, NOW())
    ON CONFLICT (global_user_id)
    DO UPDATE SET
      timezone = EXCLUDED.timezone,
      timezone_is_set = true,
      updated_at = NOW()
    `,
    [String(globalUserId), String(timezone)]
  );
}
