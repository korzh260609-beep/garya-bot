// src/media/fileIntakeCore.js
// ==================================================
// FILE-INTAKE CORE HELPERS
// Purpose:
// - shared constants
// - base utils
// - logging helpers
// ==================================================

import fs from "fs";
import path from "path";

export const TMP_DIR = path.resolve(process.cwd(), "tmp", "media");
export const DOCUMENT_REPLY_CHUNK_SIZE = 3200;
export const DOCUMENT_SESSION_BIND_WINDOW_MS = 30 * 60 * 1000; // 30 min

export function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

export function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function nowIso() {
  return new Date().toISOString();
}

export function nowMs() {
  return Date.now();
}

export function makeMeta() {
  return {
    startedAt: nowIso(),
    logs: [],
  };
}

export function pushLog(meta, level, step, msg, data = null) {
  const entry = { t: nowIso(), level, step, msg };
  if (data !== null && data !== undefined) entry.data = data;
  if (meta?.logs) meta.logs.push(entry);

  try {
    const prefix = `[FileIntake:${level}] ${step}:`;
    if (data) console.log(prefix, msg, data);
    else console.log(prefix, msg);
  } catch (_) {
    // ignore
  }
}

export function toIntOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function normalizeCommandText(value) {
  return safeStr(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function formatFileIntakeLogs(meta, limit = 20) {
  const logs = meta?.logs || [];
  if (!logs.length) return "File-Intake logs: empty.";

  const slice = logs.slice(-toIntOr(limit, 20));
  let out = "🧾 File-Intake logs\n\n";

  for (const l of slice) {
    out += `• ${l.t} [${l.level}] ${l.step}: ${l.msg}\n`;
    if (l.data) {
      out += `  data: ${safeStr(JSON.stringify(l.data)).slice(0, 600)}\n`;
    }
  }

  return out.trim();
}

export default {
  TMP_DIR,
  DOCUMENT_REPLY_CHUNK_SIZE,
  DOCUMENT_SESSION_BIND_WINDOW_MS,
  ensureTmpDir,
  safeStr,
  nowIso,
  nowMs,
  makeMeta,
  pushLog,
  toIntOr,
  normalizeCommandText,
  formatFileIntakeLogs,
};