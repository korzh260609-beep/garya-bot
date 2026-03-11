// src/bot/handlers/groupSourceMeta.js
// STAGE 7B.9 / 11.18 — Group Source meta updater (monarch-only, private-only helper)
//
// Usage:
// /group_source_meta <chat_id> --alias sandbox --privacy monarch
// /group_source_meta <chat_id> --alias my_group
// /group_source_meta <chat_id> --privacy public
//
// Safe scope:
// - updates only chat_meta alias / privacy_level
// - does NOT enable source_enabled by itself
// - does NOT read or expose messages
// - does NOT affect RecallEngine directly

import { getChatMeta, updateChatMetaFields } from "../../db/chatMetaRepo.js";

function safeText(value, max = 120) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function normalizePrivacy(value) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) return null;

  const allowed = new Set([
    "public",
    "citizens",
    "vip",
    "monarch",
    "private",
    "private_only",
  ]);

  return allowed.has(raw) ? raw : "__invalid__";
}

function normalizeAlias(value) {
  const raw = String(value ?? "").trim();

  if (!raw) return null;

  // Safe alias shape for source cards / admin usage
  // keep predictable and short
  const cleaned = raw
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  if (!cleaned) return "__invalid__";
  if (cleaned.length > 64) return cleaned.slice(0, 64);

  return cleaned;
}

function parseArgs(restRaw) {
  const parts = String(restRaw ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const result = {
    chatId: null,
    alias: null,
    privacyLevel: null,
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (!result.chatId && /^-?\d+$/.test(part)) {
      result.chatId = String(part);
      continue;
    }

    if (part === "--alias" && parts[i + 1]) {
      result.alias = normalizeAlias(parts[i + 1]);
      i++;
      continue;
    }

    if (part.startsWith("--alias=")) {
      result.alias = normalizeAlias(part.slice("--alias=".length));
      continue;
    }

    if (part === "--privacy" && parts[i + 1]) {
      result.privacyLevel = normalizePrivacy(parts[i + 1]);
      i++;
      continue;
    }

    if (part.startsWith("--privacy=")) {
      result.privacyLevel = normalizePrivacy(part.slice("--privacy=".length));
      continue;
    }
  }

  return result;
}

export async function handleGroupSourceMeta({
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

  if (!parsed.chatId) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ Usage:",
        "/group_source_meta <chat_id> --alias sandbox --privacy monarch",
        "/group_source_meta <chat_id> --alias my_group",
        "/group_source_meta <chat_id> --privacy public",
      ].join("\n")
    );
    return;
  }

  if (!parsed.alias && !parsed.privacyLevel) {
    await bot.sendMessage(
      chatId,
      [
        "⛔ Nothing to update.",
        "Provide at least one field:",
        "--alias <value>",
        "--privacy <public|citizens|vip|monarch|private|private_only>",
      ].join("\n")
    );
    return;
  }

  if (parsed.alias === "__invalid__") {
    await bot.sendMessage(
      chatId,
      [
        "⛔ invalid_alias",
        "Allowed alias output is normalized to latin/digits/_/-",
        "Example: --alias sandbox_alpha",
      ].join("\n")
    );
    return;
  }

  if (parsed.privacyLevel === "__invalid__") {
    await bot.sendMessage(
      chatId,
      [
        "⛔ invalid_privacy_level",
        "Allowed:",
        "public, citizens, vip, monarch, private, private_only",
      ].join("\n")
    );
    return;
  }

  const platform = "telegram";

  try {
    const row = await getChatMeta(platform, parsed.chatId);

    if (!row) {
      await bot.sendMessage(
        chatId,
        [
          "⚠️ chat_meta not found",
          `chat_id: ${parsed.chatId}`,
          "Сначала нужен хотя бы один сохранённый message pair в этом чате.",
        ].join("\n")
      );
      return;
    }

    const updated = await updateChatMetaFields({
      platform,
      chatId: parsed.chatId,
      alias: parsed.alias,
      privacyLevel: parsed.privacyLevel,
    });

    if (!updated) {
      await bot.sendMessage(
        chatId,
        [
          "⚠️ meta_update_failed",
          `chat_id: ${parsed.chatId}`,
        ].join("\n")
      );
      return;
    }

    await bot.sendMessage(
      chatId,
      [
        "✅ GROUP SOURCE META UPDATED",
        `chat_id: ${updated.chat_id}`,
        `platform: ${updated.platform || platform}`,
        `chat_type: ${updated.chat_type || "—"}`,
        `alias: ${updated.alias || "—"}`,
        "title: [hidden service field]",
        `source_enabled: ${String(!!updated.source_enabled)}`,
        `privacy_level: ${updated.privacy_level || "—"}`,
        `allow_quotes: ${String(!!updated.allow_quotes)}`,
        `allow_raw_snippets: ${String(!!updated.allow_raw_snippets)}`,
        updated.updated_at
          ? `updated_at: ${new Date(updated.updated_at).toISOString()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  } catch (e) {
    console.error("handleGroupSourceMeta error:", e);
    await bot.sendMessage(
      chatId,
      `⛔ Ошибка: ${safeText(e?.message || "unknown", 160)}`
    );
  }
}

export default handleGroupSourceMeta;