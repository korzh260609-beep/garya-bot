// src/sources/sourcesDebug.js
// Вспомогательные функции для просмотра списка источников (Этап 5).

import pool from "../../db.js";

/**
 * Возвращает список всех источников из таблицы "sources" (даже отключённых).
 * Используется в команде /sources.
 */
export async function getAllSourcesSafe() {
  try {
    const result = await pool.query(
      `
        SELECT key, name, type, enabled, url, config
        FROM sources
        ORDER BY key
      `
    );
    return result.rows;
  } catch (err) {
    console.error("❌ getAllSourcesSafe error:", err);
    return [];
  }
}

/**
 * Формирует красивый список источников для Telegram (команда /sources).
 */
export function formatSourcesList(sources) {
  if (!sources || sources.length === 0) {
    return "Источники не найдены.";
  }

  return sources
    .map((src) => {
      return `
🔹 <b>${src.name}</b>
key: <code>${src.key}</code>
type: <code>${src.type}</code>
enabled: ${src.enabled ? "🟢" : "🔴"}
      `.trim();
    })
    .join("\n\n");
}

/**
 * Заглушки для совместимости.
 * Чтобы index.js не падал, даже если кто-то случайно импортирует эти функции
 * из sourcesDebug.js вместо sources.js.
 * Реальная логика находится в src/sources/sources.js
 */

export async function ensureDefaultSources() {
  console.warn("⚠️ ensureDefaultSources() вызвано из sourcesDebug.js — это заглушка. Используйте sources.js");
  return [];
}

export async function runSourceDiagnosticsOnce() {
  console.warn("⚠️ runSourceDiagnosticsOnce() вызвано из sourcesDebug.js — это заглушка. Используйте sources.js");
  return { ok: false, error: "debug placeholder" };
}

export async function fetchFromSourceKey() {
  console.warn("⚠️ fetchFromSourceKey() вызвано из sourcesDebug.js — это заглушка. Используйте sources.js");
  return null;
}
