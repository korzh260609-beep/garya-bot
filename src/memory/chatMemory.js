// src/memory/chatMemory.js
// Работа с таблицей chat_memory: чтение истории, очистка, сохранение диалога.
//
// STAGE 7.2 LOGIC: поддержка колонок v2:
// - global_user_id (text)
// - transport (text)
// - metadata (jsonb)
// - schema_version (int)

import pool from "../../db.js";

const MAX_HISTORY_MESSAGES = 20;

// v2 defaults
const DEFAULT_SCHEMA_VERSION = 1;
const DEFAULT_TRANSPORT = "telegram";

function _safeJson(obj) {
  try {
    if (!obj) return {};
    if (typeof obj === "object") return obj;
    return { value: String(obj) };
  } catch (_) {
    return {};
  }
}

/**
 * Возвращает историю чата в формате [{ role, content }, ...],
 * отсортированную от старых к новым (как нужно для ИИ).
 *
 * v2: если передан opts.globalUserId — фильтруем по нему.
 */
export async function getChatHistory(chatId, limit = MAX_HISTORY_MESSAGES, opts = {}) {
  try {
    const globalUserId = opts?.globalUserId ?? null;

    const result = await pool.query(
      `
        SELECT role, content
        FROM chat_memory
        WHERE chat_id = $1
          AND ($3::text IS NULL OR global_user_id = $3)
        ORDER BY id DESC
        LIMIT $2
      `,
      [chatId, limit, globalUserId]
    );

    return result.rows.reverse().map((row) => ({
      role: row.role,
      content: row.content,
    }));
  } catch (err) {
    console.error("❌ getChatHistory DB error:", err);
    return [];
  }
}

/**
 * Авто-очистка: оставляем только последние MAX_HISTORY_MESSAGES записей.
 * ⚠️ В ЭТАПЕ 3.6 мы её больше НЕ вызываем, чтобы накапливать долговременную память.
 * Функцию оставляем на будущее (для резюмирования/архивирования).
 */
export async function cleanupChatHistory(chatId, maxMessages = MAX_HISTORY_MESSAGES) {
  try {
    const res = await pool.query(
      `
        SELECT id
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        OFFSET $2
      `,
      [chatId, maxMessages]
    );

    if (res.rows.length === 0) return;

    const idsToDelete = res.rows.map((r) => r.id);

    await pool.query(
      `
        DELETE FROM chat_memory
        WHERE id = ANY($1::int[])
      `,
      [idsToDelete]
    );

    console.log(
      `🧹 cleanupChatHistory: удалено ${idsToDelete.length} старых записей для чата ${chatId}`
    );
  } catch (err) {
    console.error("❌ cleanupChatHistory DB error:", err);
  }
}

/**
 * Сохраняем одно сообщение в память с защитой от дублей подряд (ЭТАП 3.6).
 *
 * v2: 4-й параметр options (необязательный):
 * {
 *   globalUserId?: string|null,
 *   transport?: string,
 *   metadata?: object,
 *   schemaVersion?: number
 * }
 *
 * ⚠️ Старые вызовы saveMessageToMemory(chatId, role, content) продолжат работать.
 */
export async function saveMessageToMemory(chatId, role, content, options = {}) {
  if (!content || !content.trim()) return;

  const globalUserId = options?.globalUserId ?? null;
  const transport = String(options?.transport || DEFAULT_TRANSPORT);
  const metadata = _safeJson(options?.metadata);
  const schemaVersion =
    Number.isFinite(options?.schemaVersion) && Number(options.schemaVersion) > 0
      ? Number(options.schemaVersion)
      : DEFAULT_SCHEMA_VERSION;

  try {
    // Берём последнее сообщение в этом чате (и global_user_id если он задан)
    const lastRes = await pool.query(
      `
        SELECT role, content
        FROM chat_memory
        WHERE chat_id = $1
          AND ($2::text IS NULL OR global_user_id = $2)
        ORDER BY id DESC
        LIMIT 1
      `,
      [chatId, globalUserId]
    );

    const last = lastRes.rows[0];
    if (last && last.role === role && last.content === content) {
      return; // дубль подряд — не пишем
    }

    await pool.query(
      `
        INSERT INTO chat_memory (
          chat_id,
          role,
          content,
          global_user_id,
          transport,
          metadata,
          schema_version
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      `,
      [chatId, role, content, globalUserId, transport, JSON.stringify(metadata), schemaVersion]
    );
  } catch (err) {
    console.error("❌ saveMessageToMemory DB error:", err);
  }
}

/**
 * Сохраняем связку пользователь + ассистент как пару сообщений.
 *
 * v2: 4-й параметр options прокидывается в оба сохранения.
 */
export async function saveChatPair(chatId, userText, assistantText, options = {}) {
  try {
    await saveMessageToMemory(chatId, "user", userText, options);
    await saveMessageToMemory(chatId, "assistant", assistantText, options);

    // ВАЖНО: больше не чистим историю. Долговременная память накапливается.
    // await cleanupChatHistory(chatId, MAX_HISTORY_MESSAGES);
  } catch (err) {
    console.error("❌ saveChatPair DB error:", err);
  }
}
