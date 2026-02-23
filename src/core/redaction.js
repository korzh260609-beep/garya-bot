// src/core/redaction.js
// STAGE 7B.10 — REDACTION RULES (MVP)
// Goal: protect chat_history storage: redact @mentions, emails, phones; safe-snippet; no raw text in DB.

import crypto from "crypto";

/**
 * Redact sensitive patterns from text.
 * MVP rules:
 * - remove @mentions
 * - remove emails
 * - remove phone-like sequences
 * - collapse excessive spaces
 */
export function redactText(input) {
  if (!input || typeof input !== "string") return "";

  let s = input;

  // 7B.10.1 remove @mentions
  s = s.replace(/@\w{2,32}/g, "@[redacted]");

  // 7B.10.2 remove emails
  s = s.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[email_redacted]"
  );

  // 7B.10.2 remove phone numbers (simple heuristic)
  // matches: +380..., 0xx..., or long digit sequences with separators
  s = s.replace(
    /(\+?\d[\d\s().-]{6,}\d)/g,
    "[phone_redacted]"
  );

  // normalize spaces
  s = s.replace(/[ \t]{2,}/g, " ").trim();

  return s;
}

/**
 * 7B.10.3 safe-truncate snippets (400–800 chars)
 * Default: 600.
 */
export function safeSnippet(input, maxLen = 600) {
  const s = redactText(input);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen).trimEnd() + "…";
}

export function sha256Text(input) {
  const s = typeof input === "string" ? input : "";
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * 7B.5.2 no binary / meta only:
 * Build minimal "raw" payload for DB (NO text, NO attachments).
 */
export function buildRawMeta(msg) {
  try {
    const chat = msg?.chat || {};
    const from = msg?.from || {};

    return {
      message_id: msg?.message_id ?? null,
      date: msg?.date ?? null,

      chat: {
        id: chat?.id ?? null,
        type: chat?.type ?? null,
        title: chat?.title ?? null,
        username: chat?.username ?? null,
      },

      from: {
        id: from?.id ?? null,
        is_bot: from?.is_bot ?? null,
        username: from?.username ?? null,
        first_name: from?.first_name ?? null,
        last_name: from?.last_name ?? null,
      },

      // keep only minimal routing hints
      has_media: Boolean(msg?.photo || msg?.video || msg?.document || msg?.audio || msg?.voice),
      has_entities: Array.isArray(msg?.entities) ? msg.entities.length : 0,
    };
  } catch (_) {
    return {};
  }
}
