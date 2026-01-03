// src/bot/handlers/arList.js

import pool from "../../../db.js";

export async function handleArList({
  bot,
  chatId,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const limitRaw = Number((rest || "").trim());
  const n = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(limitRaw, 30))
    : 10;

  try {
    const res = await pool.query(
      `
      SELECT
        id,
        COALESCE(status, 'pending') AS status,
        requester_chat_id,
        COALESCE(requester_name, '') AS requester_name,
        COALESCE(requester_role, '') AS requester_role,
        COALESCE(requested_action, '') AS requested_action,
        COALESCE(requested_cmd, '') AS requested_cmd,
        created_at
      FROM access_requests
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [n]
    );

    if (!res.rows || res.rows.length === 0) {
      await bot.sendMessage(chatId, "🛡️ access_requests пусто.");
      return;
    }

    let out = `🛡️ Access Requests (last ${res.rows.length})\n\n`;

    for (const r of res.rows) {
      out += `#${r.id} | ${r.status} | ${new Date(r.created_at).toISOString()}\n`;
      out += `who=${r.requester_chat_id}`;
      if (r.requester_name) out += ` (${r.requester_name})`;
      out += `\n`;
      if (r.requester_role) out += `role=${r.requester_role}\n`;
      if (r.requested_action) out += `action=${r.requested_action}\n`;
      if (r.requested_cmd) out += `cmd=${r.requested_cmd}\n`;
      out += `\n`;
    }

    await bot.sendMessage(chatId, out.slice(0, 3800));
  } catch (e) {
    console.error("❌ /ar_list error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения access_requests.");
  }
}
