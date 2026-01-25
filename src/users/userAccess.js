// src/bot/users/userAccess.js
import pool from "../../db.js";

/**
 * DB-only access resolver (role/plan/bypass).
 * IMPORTANT: behavior must remain identical to legacy router logic.
 */
export async function resolveUserAccess({
  chatIdStr,
  senderIdStr,
  DEFAULT_PLAN = "free",
  isMonarch, // function(chatIdOrSenderIdStr) -> boolean (legacy behavior is preserved by caller)
}) {
  // ✅ SAFETY: never crash if caller forgot to pass isMonarch(fn)
  const isMonarchFn = typeof isMonarch === "function" ? isMonarch : () => false;

  // 1) role + plan
  let userRole = "guest";
  let userPlan = DEFAULT_PLAN;

  try {
    const uRes = await pool.query("SELECT role FROM users WHERE chat_id = $1", [
      chatIdStr,
    ]);
    if (uRes.rows.length) userRole = uRes.rows[0].role || "guest";
  } catch (e) {
    console.error("❌ Error fetching user role:", e);
  }

  // ✅ SAFETY: только реальный MONARCH_CHAT_ID может иметь роль monarch
  if ((userRole || "").toLowerCase() === "monarch" && !isMonarchFn(senderIdStr)) {
    console.warn("⚠️ ROLE GUARD: non-monarch had role=monarch in DB:", senderIdStr);
    userRole = "guest";
  }

  const bypass = isMonarchFn(senderIdStr);

  // ✅ Backward-compatible access object
  const access = {
    userRole,
    userPlan,
    bypassPermissions: bypass,

    // Aliases (do not change meaning; helps callers that expect role/plan keys)
    role: userRole,
    plan: userPlan,
    bypass,
  };

  // ✅ единый user-объект для permissions-layer
  const user = { role: userRole, plan: userPlan, bypassPermissions: bypass };

  return { userRole, userPlan, bypass, access, user };
}
