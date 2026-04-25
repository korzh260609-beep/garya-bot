// src/bot/telegram/telegramTextUtils.js
// ============================================================================
// Telegram text utilities
// Purpose:
// - keep Telegram-specific text limits outside command handlers
// - keep handlers thinner
// - no business logic
// - no DB calls
// - no writes
// ============================================================================

export const TELEGRAM_SAFE_TEXT_LIMIT = 3800;

export function truncateTelegramText(
  text,
  limit = TELEGRAM_SAFE_TEXT_LIMIT,
  suffix = "\n…(обрезано)"
) {
  const value = String(text ?? "");
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : TELEGRAM_SAFE_TEXT_LIMIT;

  if (value.length <= safeLimit) {
    return value;
  }

  const safeSuffix = String(suffix ?? "");
  const sliceLimit = Math.max(0, safeLimit - safeSuffix.length);
  return value.slice(0, sliceLimit) + safeSuffix;
}

export function chunkTelegramText(text, limit = TELEGRAM_SAFE_TEXT_LIMIT) {
  const value = String(text ?? "");
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : TELEGRAM_SAFE_TEXT_LIMIT;

  if (!value) {
    return [""];
  }

  const parts = [];
  let cursor = 0;

  while (cursor < value.length) {
    parts.push(value.slice(cursor, cursor + safeLimit));
    cursor += safeLimit;
  }

  return parts;
}

export function chunkTelegramTextWithPrefix({
  text,
  prefixBuilder,
  limit = TELEGRAM_SAFE_TEXT_LIMIT,
  minChunkSize = 500,
}) {
  const value = String(text ?? "");
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : TELEGRAM_SAFE_TEXT_LIMIT;
  const safeMinChunkSize = Number.isFinite(minChunkSize) && minChunkSize > 0
    ? Math.floor(minChunkSize)
    : 500;

  const buildPrefix = typeof prefixBuilder === "function"
    ? prefixBuilder
    : () => "";

  if (!value) {
    return [buildPrefix(1, 1)];
  }

  const roughParts = chunkTelegramText(value, safeLimit);
  const roughTotal = Math.max(1, roughParts.length);

  const chunks = [];
  let cursor = 0;

  for (let partIndex = 1; cursor < value.length; partIndex++) {
    const roughPrefix = String(buildPrefix(partIndex, roughTotal) ?? "");
    const available = Math.max(safeMinChunkSize, safeLimit - roughPrefix.length);

    chunks.push(value.slice(cursor, cursor + available));
    cursor += available;
  }

  const finalTotal = chunks.length || 1;

  return chunks.map((chunk, index) => {
    const prefix = String(buildPrefix(index + 1, finalTotal) ?? "");
    return prefix + chunk;
  });
}

export default {
  TELEGRAM_SAFE_TEXT_LIMIT,
  truncateTelegramText,
  chunkTelegramText,
  chunkTelegramTextWithPrefix,
};
