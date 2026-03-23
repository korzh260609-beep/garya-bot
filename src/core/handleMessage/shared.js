// src/core/handleMessage/shared.js

import { envStr, envIntRange } from "../config.js";

export const CMD_RL_WINDOW_MS = envIntRange("CMD_RL_WINDOW_MS", 20000, {
  min: 1000,
  max: 300000,
});

export const CMD_RL_MAX = envIntRange("CMD_RL_MAX", 6, {
  min: 1,
  max: 50,
});

export const MAX_CHAT_MESSAGE_CHARS = 16000;

// ✅ SAFE COMMANDS — MUST ALWAYS REPLY
export const IDEMPOTENCY_BYPASS = new Set(["/start", "/help"]);

export function envBool(name, def = false) {
  const v = envStr(name, def ? "true" : "false").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return def;
}

export function safeDiagText(value, maxLen = 500) {
  const text = typeof value === "string" ? value : String(value ?? "");
  if (!text) return "—";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export function safeDiagTs(value) {
  try {
    return value ? new Date(value).toISOString() : "—";
  } catch {
    return "—";
  }
}

export function truncateForDb(s) {
  const t = typeof s === "string" ? s : String(s ?? "");
  if (t.length <= MAX_CHAT_MESSAGE_CHARS) {
    return { text: t, truncated: false };
  }
  return { text: t.slice(0, MAX_CHAT_MESSAGE_CHARS), truncated: true };
}