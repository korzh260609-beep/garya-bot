// src/bot/handlers/groupSourceTopicDiag.js
// STAGE 8A / SAFE DIAG — Group Source topic diagnostics (monarch-only, private-only)
//
// Purpose:
// - read-only diagnostics for chat_meta topic-related fields
// - checks information_schema for optional columns:
//   safe_topic / topic / meta / metadata
// - reads ONLY chat_meta
// - shows safe stats + safe per-row presence preview
//
// Hard rules:
// - NO chat_messages reads
// - NO cross-group retrieval
// - NO author identity
// - NO quotes
// - NO raw snippets
// - NO topic text output

import { getChatMetaTopicDiag } from "../../db/chatMetaRepo.js";

function safeText(value, max = 120) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function safeInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseArgs(restRaw) {
  const parts = String(restRaw ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const result = {
    limit: 10,
    chatId: null,
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part === "--limit" && parts[i + 1]) {
      result.limit = clamp(safeInt(parts[i + 1], result.limit), 1, 50);
      i++;
      continue;
    }

    if (part.startsWith("--limit=")) {
      result.limit = clamp(
        safeInt(part.slice("--limit=".length), result.limit),
        1,
        50
      );
      continue;
    }

    if (part === "--chat_id" && parts[i + 1]) {
      result.chatId = String(parts[i + 1]).trim();
      i++;
      continue;
    }

    if (part.startsWith("--chat_id=")) {
      result.chatId = String(part.slice("--chat_id=".length)).trim();
      continue;
    }

    if (!result.chatId && /^-?\d+$/.test(part)) {
      result.chatId = String(part).trim();
      continue;
    }
  }

  return result;
}

function formatBool(value) {
  return value ? "true" : "false";
}

export async function handleGroupSourceTopicDiag({
  bot,
  chatId,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "⛔ Monarch only.");
    return;
  }

  const parsed = parseArgs(rest);

  try {
    const result = await getChatMetaTopicDiag({
      platform: "telegram",
      chatId: parsed.chatId,
      limit: parsed.limit,
    });

    const lines = [
      "GROUP SOURCE TOPIC DIAG",
      `platform=${result.platform}`,
      `chat_filter=${result.chat_filter || "—"}`,
      `limit=${result.limit}`,
      "",
      "OPTIONAL COLUMNS:",
      `safe_topic=${formatBool(result.optional_columns?.safe_topic)}`,
      `topic=${formatBool(result.optional_columns?.topic)}`,
      `meta=${formatBool(result.optional_columns?.meta)}`,
      `metadata=${formatBool(result.optional_columns?.metadata)}`,
      "",
      "SAFE STATS:",
      `rows_scanned=${result.stats?.rows_scanned ?? 0}`,
      `rows_with_safe_topic=${result.stats?.rows_with_safe_topic ?? 0}`,
      `rows_with_topic=${result.stats?.rows_with_topic ?? 0}`,
      `rows_with_meta_topic=${result.stats?.rows_with_meta_topic ?? 0}`,
      `rows_with_metadata_topic=${result.stats?.rows_with_metadata_topic ?? 0}`,
      `rows_with_any_topic=${result.stats?.rows_with_any_topic ?? 0}`,
      "",
      "SAFE RULES:",
      "chat_messages_reads=false",
      "cross_group_retrieval=false",
      "author_identity=false",
      "quotes=false",
      "raw_snippets=false",
    ];

    const rows = Array.isArray(result.rows) ? result.rows : [];

    if (rows.length) {
      lines.push("");
      lines.push("SAFE ROW PREVIEW:");

      rows.forEach((row, index) => {
        lines.push(
          `${index + 1}. ${safeText(row.alias || "—", 64)} | chat_id=${safeText(
            row.chat_id || "—",
            40
          )}`
        );
        lines.push(
          `type=${safeText(row.chat_type || "—", 20)} | source_enabled=${formatBool(
            row.source_enabled
          )} | privacy=${safeText(row.privacy_level || "—", 20)}`
        );
        lines.push(
          `safe_topic=${formatBool(row.topic_presence?.safe_topic)} | topic=${formatBool(
            row.topic_presence?.topic
          )} | meta_topic=${formatBool(
            row.topic_presence?.meta_topic
          )} | metadata_topic=${formatBool(
            row.topic_presence?.metadata_topic
          )} | any=${formatBool(row.topic_presence?.any)}`
        );
        lines.push(
          `last_message_at=${safeText(
            row.last_message_at || "—",
            32
          )} | updated_at=${safeText(row.updated_at || "—", 32)}`
        );
        lines.push("");
      });
    }

    const text = lines.join("\n").trim().slice(0, 4000);
    await bot.sendMessage(chatId, text);
  } catch (e) {
    console.error("handleGroupSourceTopicDiag error:", e);
    await bot.sendMessage(
      chatId,
      `⛔ Ошибка: ${safeText(e?.message || "unknown", 160)}`
    );
  }
}

export default handleGroupSourceTopicDiag;