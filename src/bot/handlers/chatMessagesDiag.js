// ============================================================================
// === src/bot/handlers/chatMessagesDiag.js
// Stage 7B foundation — diagnostic command for chat_messages storage
// Rules:
// - read-only
// - monarch-only
// - private chat only
// - no runtime architecture rewrite
// ============================================================================

import pool from "../../../db.js";

function safeText(value, maxLen = 500) {
  const text = typeof value === "string" ? value : String(value ?? "");
  if (!text) return "—";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function safeTs(value) {
  try {
    return value ? new Date(value).toISOString() : "—";
  } catch {
    return "—";
  }
}

async function requireMonarchPrivate({ bot, chatId, senderIdStr, isPrivateChat }) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();

  if (!isPrivateChat) {
    await bot.sendMessage(chatId, "⛔ /chat_messages_diag доступна только в личке.");
    return false;
  }

  if (!MONARCH_USER_ID) {
    return true;
  }

  if (String(senderIdStr || "") !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }

  return true;
}

export async function handleChatMessagesDiag({
  bot,
  chatId,
  chatIdStr,
  senderIdStr,
  globalUserId = null,
  isPrivateChat = false,
}) {
  const ok = await requireMonarchPrivate({
    bot,
    chatId,
    senderIdStr,
    isPrivateChat,
  });
  if (!ok) return;

  try {
    const [
      totalChatMessagesRes,
      lastUserMessageRes,
      lastAssistantMessageRes,
      dedupeCountRes,
      lastDedupeEventRes,
    ] = await Promise.all([
      pool.query(
        `
        SELECT COUNT(*)::int AS n
        FROM chat_messages
        WHERE chat_id = $1
        `,
        [String(chatIdStr)]
      ),

      pool.query(
        `
        SELECT id, message_id, created_at, content
        FROM chat_messages
        WHERE chat_id = $1
          AND role = 'user'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `,
        [String(chatIdStr)]
      ),

      pool.query(
        `
        SELECT id, created_at, content
        FROM chat_messages
        WHERE chat_id = $1
          AND role = 'assistant'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `,
        [String(chatIdStr)]
      ),

      pool.query(
        `
        SELECT COUNT(*)::int AS n
        FROM webhook_dedupe_events
        WHERE chat_id = $1
        `,
        [String(chatIdStr)]
      ),

      pool.query(
        `
        SELECT id, message_id, created_at, reason
        FROM webhook_dedupe_events
        WHERE chat_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        `,
        [String(chatIdStr)]
      ),
    ]);

    const totalChatMessages = totalChatMessagesRes.rows?.[0]?.n ?? 0;
    const totalDedupeEvents = dedupeCountRes.rows?.[0]?.n ?? 0;

    const lastUser = lastUserMessageRes.rows?.[0] || null;
    const lastAssistant = lastAssistantMessageRes.rows?.[0] || null;
    const lastDedupe = lastDedupeEventRes.rows?.[0] || null;

    const lines = [];
    lines.push("🧠 CHAT_MESSAGES DIAG");
    lines.push("");
    lines.push(`chat_id: ${chatIdStr}`);
    lines.push(`global_user_id: ${globalUserId || "—"}`);
    lines.push("");
    lines.push(`total_chat_messages: ${totalChatMessages}`);
    lines.push("");
    lines.push("last_user_message:");
    if (!lastUser) {
      lines.push("—");
    } else {
      lines.push(`id=${lastUser.id ?? "—"}`);
      lines.push(`message_id=${lastUser.message_id ?? "—"}`);
      lines.push(`created_at=${safeTs(lastUser.created_at)}`);
      lines.push(`content=${safeText(lastUser.content)}`);
    }

    lines.push("");
    lines.push("last_assistant_message:");
    if (!lastAssistant) {
      lines.push("—");
    } else {
      lines.push(`id=${lastAssistant.id ?? "—"}`);
      lines.push(`created_at=${safeTs(lastAssistant.created_at)}`);
      lines.push(`content=${safeText(lastAssistant.content)}`);
    }

    lines.push("");
    lines.push("dedupe_events:");
    lines.push(`count=${totalDedupeEvents}`);
    if (!lastDedupe) {
      lines.push("last_event=—");
    } else {
      lines.push(
        `last_event=id=${lastDedupe.id ?? "—"} | message_id=${lastDedupe.message_id ?? "—"} | created_at=${safeTs(lastDedupe.created_at)} | reason=${lastDedupe.reason || "—"}`
      );
    }

    await bot.sendMessage(chatId, lines.join("\n").slice(0, 3900));
  } catch (e) {
    console.error("❌ handleChatMessagesDiag failed:", e);
    await bot.sendMessage(
      chatId,
      "⚠️ /chat_messages_diag failed. Проверь Render logs и схему таблиц."
    );
  }
}