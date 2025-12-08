// sources/sourcesDebug.js
// Вспомогательные функции для просмотра списка источников (Этап 5).

import pool from "../db.js";

/**
 * Возвращает список всех источников из таблицы "sources" (даже отключённых).
 * В index.js используется в команде /sources.
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

