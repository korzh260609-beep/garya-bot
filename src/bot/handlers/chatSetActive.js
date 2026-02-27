// src/bot/handlers/chatSetActive.js
// Stage 4.3 — Chat Gate admin (monarch-only)
// Usage:
// - /chat_on [chat_id] [reason...]
// - /chat_off [chat_id] [reason...]

import { setChatActive } from "../../db/chatRepo.js";

function parseArgs(rest) {
  const raw = String(rest || "").trim();
  if (!raw) return { targetChatId: null, reason: null };

  const parts = raw.split(/\s+/);
  const first = parts[0];

  // If first token looks like an integer chat id → treat as chat id
  if (/^-?\d+$/.test(first)) {
    const targetChatId = String(first);
    const reason = parts.slice(1).join(" ").trim() || null;
    return { targetChatId, reason };
  }

  // Otherwise: no explicit chat id; treat full rest as reason
  return { targetChatId: null, reason: raw || null };
}

export async function handleChatSetActive({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  isActive,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Monarch only.");
    return;
  }

  const { targetChatId, reason } = parseArgs(rest);
  const effectiveChatId = targetChatId || String(chatIdStr);

  try {
    const row = await setChatActive({
      chatId: effectiveChatId,
      transport: "telegram",
      isActive: !!isActive,
      by: "monarch",
      reason: reason || null,
    });

    if (!row) {
      await bot.sendMessage(
        chatId,
        `⚠️ Не найден chat_id=${effectiveChatId} (возможно чат ещё не появлялся в таблице chats).`
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ CHAT UPDATED",
        `chat_id: ${row.chat_id}`,
        `transport: ${row.transport || "telegram"}`,
        `is_active: ${String(!!row.is_active)}`,
        row.deactivated_at ? `deactivated_at: ${new Date(row.deactivated_at).toISOString()}` : "",
        row.deactivated_by ? `deactivated_by: ${row.deactivated_by}` : "",
        row.deactivate_reason ? `reason: ${row.deactivate_reason}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    console.error("handleChatSetActive error:", e);
    await bot.sendMessage(chatId, `⛔ Ошибка: ${e?.message || "unknown"}`);
  }
}
