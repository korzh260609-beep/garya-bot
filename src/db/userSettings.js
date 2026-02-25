// src/db/userSettings.js
// STAGE 8C (timezone groundwork)
// DB-layer only. No business logic here.

import pool from "../../db.js";

/**
 * Get timezone for user.
 * If not found → return "UTC" (default policy).
 */
export async function getUserTimezone(globalUserId) {
  if (!globalUserId) return "UTC";

  const r = await pool.query(
    `
    SELECT timezone
    FROM user_settings
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [String(globalUserId)]
  );

  if (r.rowCount === 0) return "UTC";

  return r.rows[0].timezone || "UTC";
}

/**
 * Set or update timezone (IANA string).
 */
export async function setUserTimezone(globalUserId, timezone) {
  if (!globalUserId) return;

  await pool.query(
    `
    INSERT INTO user_settings (global_user_id, timezone, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (global_user_id)
    DO UPDATE SET
      timezone = EXCLUDED.timezone,
      updated_at = NOW()
    `,
    [String(globalUserId), String(timezone)]
  );
}
