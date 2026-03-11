// src/bot/handlers/mySeenChats.js
// Monarch-private diagnostic helper:
// list chats already known in chat_meta without enabling system commands in groups.
//
// Safe scope:
// - read only from chat_meta
// - no messages
// - no authors
// - no recall integration
// - no source content
//
// Intended usage:
// /my_seen_chats
// /my_seen_chats 30
// /my_seen_chats --all
// /my_seen_chats 50 --all

import { listKnownChats } from "../../db/chatMetaRepo.js";

function safeInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeText(value, max = 120) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function parseArgs(restRaw) {
  const parts = String(restRaw ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let limit = 20;
  let includePrivate = false;

  for (const part of parts) {
    if (part === "--all") {
      includePrivate = true;
      continue;
    }

    if (/^\d+$/.test(part)) {
      limit = safeInt(part, limit);
    }
  }

  limit = clamp(limit, 1, 100);

  return { limit, includePrivate };
}

function formatIsoShort(value) {
  if (!value) return "—";

  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toISOString().slice(0, 16);
  } catch (_) {
    return "—";
  }
}

function formatRow(row, index) {
  return [
    `${index}. chat_id: ${safeText(row.chat_id, 80)}`,
    `   type: ${safeText(row.chat_type, 30)}`,
    `   alias: ${safeText(row.alias, 60)}`,
    `   source_enabled: ${String(!!row.source_enabled)}`,
    `   privacy_level: ${safeText(row.privacy_level, 30)}`,
    `   message_count: ${row.message_count ?? "—"}`,
    `   last_message_at: ${formatIsoShort(row.last_message_at)}`,
  ].join("\n");
}

export async function handleMySeenChats({
  bot,
  chatId,
  rest,
  bypass = false,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Monarch only.");
    return;
  }

  const { limit, includePrivate } = parseArgs(rest);

  try {
    const rows = await listKnownChats({
      platform: "telegram",
      limit,
      includePrivate,
    });

    if (!rows.length) {
      await bot.sendMessage(
        chatId,
        [
          "MY SEEN CHATS",
          "status: empty",
          `limit: ${limit}`,
          `include_private: ${String(includePrivate)}`,
          "",
          "ℹ️ chat_meta пока не содержит подходящих записей.",
        ].join("\n")
      );
      return;
    }

    const lines = [
      "MY SEEN CHATS",
      `count: ${rows.length}`,
      `limit: ${limit}`,
      `include_private: ${String(includePrivate)}`,
      "",
    ];

    rows.forEach((row, idx) => {
      lines.push(formatRow(row, idx + 1));
      if (idx < rows.length - 1) {
        lines.push("");
      }
    });

    await bot.sendMessage(chatId, lines.join("\n"));
  } catch (e) {
    console.error("handleMySeenChats error:", e);
    await bot.sendMessage(
      chatId,
      `⛔ Ошибка: ${safeText(e?.message || "unknown", 160)}`
    );
  }
}