// src/bot/handlers/chatStatus.js
// Stage 4.3 — Chat Gate admin status (monarch-only)
// Usage:
// - /chat_status [chat_id]

import { getChatById } from "../../db/chatRepo.js";

export async function handleChatStatus({ bot, chatId, chatIdStr, rest, bypass }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Monarch only.");
    return;
  }

  const raw = String(rest || "").trim();
  const targetChatId = raw && /^-?\d+$/.test(raw) ? String(raw) : String(chatIdStr);

  try {
    const row = await getChatById({ chatId: targetChatId, transport: "telegram" });

    if (!row) {
      await bot.sendMessage(
        chatId,
        `⚠️ Не найден chat_id=${targetChatId} (возможно чат ещё не появлялся в таблице chats).`
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "🧩 CHAT STATUS",
        `chat_id: ${row.chat_id}`,
        `transport: ${row.transport || "telegram"}`,
        `chat_type: ${row.chat_type || "—"}`,
        `title: ${row.title || "—"}`,
        `is_active: ${String(!!row.is_active)}`,
        row.last_seen_at ? `last_seen_at: ${new Date(row.last_seen_at).toISOString()}` : "last_seen_at: —",
        row.updated_at ? `updated_at: ${new Date(row.updated_at).toISOString()}` : "updated_at: —",
        row.deactivated_at ? `deactivated_at: ${new Date(row.deactivated_at).toISOString()}` : "",
        row.deactivated_by ? `deactivated_by: ${row.deactivated_by}` : "",
        row.deactivate_reason ? `reason: ${row.deactivate_reason}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    console.error("handleChatStatus error:", e);
    await bot.sendMessage(chatId, `⛔ Ошибка: ${e?.message || "unknown"}`);
  }
}
