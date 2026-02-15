// src/users/userAccess.js
// STAGE 4.5 — Access через global_user_id (архитектурно чисто)

import pool from "../../db.js";

export async function resolveUserAccess({ chatIdStr, senderIdStr, isMonarch }) {
  if (!chatIdStr) {
    throw new Error("resolveUserAccess: chatIdStr is required");
  }

  // 1️⃣ Получаем пользователя по transport chat_id
  const userRes = await pool.query(
    `
    SELECT global_user_id, role, language
    FROM users
    WHERE chat_id = $1
    LIMIT 1
    `,
    [chatIdStr]
  );

  // Если профиля нет — гость
  if (userRes.rows.length === 0) {
    return {
      userRole: "guest",
      userPlan: "free",
      user: {
        role: "guest",
        plan: "free",
        bypassPermissions: false,
      },
    };
  }

  const { global_user_id, role } = userRes.rows[0];

  // 2️⃣ Проверяем identity (чистая архитектура)
  const identityRes = await pool.query(
    `
    SELECT provider, provider_user_id
    FROM user_identities
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [global_user_id]
  );

  const hasIdentity = identityRes.rows.length > 0;

  // 3️⃣ Monarch override (по senderIdStr)
  const monarchOverride =
    typeof isMonarch === "function" && isMonarch(senderIdStr);

  const finalRole = monarchOverride ? "monarch" : role || "guest";

  return {
    userRole: finalRole,
    userPlan: "free", // планы подключим позже
    user: {
      role: finalRole,
      plan: "free",
      bypassPermissions: monarchOverride,
      global_user_id,
      hasIdentity,
    },
  };
}
