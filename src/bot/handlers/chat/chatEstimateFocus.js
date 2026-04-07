// src/bot/handlers/chat/chatEstimateFocus.js

import { safeText } from "./chatShared.js";

export function normalizeSemanticText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasAnyStem(text, stems = []) {
  return stems.some((stem) => text.includes(stem));
}

export function resolveEstimateFocus(userText = "") {
  const normalized = normalizeSemanticText(userText);
  if (!normalized) return "chunk_count";

  const asksTokens = hasAnyStem(normalized, [
    "токен",
    "token",
    "tokens",
    "сколько токен",
    "примерно токен",
  ]);

  const asksChars = hasAnyStem(normalized, [
    "символ",
    "знак",
    "букв",
    "characters",
    "chars",
    "char count",
  ]);

  const asksParts = hasAnyStem(normalized, [
    "част",
    "кус",
    "фрагмент",
    "сообщени",
    "chunk",
    "chunks",
    "parts",
    "messages",
  ]);

  if (asksChars && asksTokens) return "chars_and_tokens";
  if (asksTokens) return "tokens";
  if (asksChars) return "chars";
  if (asksParts) return "chunk_count";

  return "chunk_count";
}

export default {
  normalizeSemanticText,
  hasAnyStem,
  resolveEstimateFocus,
};
