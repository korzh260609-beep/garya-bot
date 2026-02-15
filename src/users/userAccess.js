// src/users/userAccess.js
import { pool } from "../../db.js";

const MONARCH_TG_ID = "677128443";

export async function resolveUserAccess({ provider, providerUserId }) {
  try {
    const { rows } = await pool.query(
      `
      SELECT u.role, u.global_user_id
      FROM user_identities ui
      JOIN users u ON u.global_user_id = ui.global_user_id
      WHERE ui.provider = $1
      AND ui.provider_user_id = $2
      LIMIT 1
      `,
      [provider, providerUserId]
    );

    if (!rows.length) {
      return {
        role: "guest",
        globalUserId: null,
        bypass: false,
      };
    }

    const { role, global_user_id } = rows[0];

    // hard monarch override check
    const isMonarch =
      provider === "telegram" && providerUserId === MONARCH_TG_ID;

    return {
      role: isMonarch ? "monarch" : role || "guest",
      globalUserId: global_user_id,
      bypass: isMonarch,
    };
  } catch (err) {
    console.error("resolveUserAccess error:", err);
    return {
      role: "guest",
      globalUserId: null,
      bypass: false,
    };
  }
}
