// memory/chatMemory.js
// Работа с таблицей chat_memory: чтение истории, очистка, сохранение диалога.

// Важно: db.js лежит в корне, поэтому путь "../../db.js"
import pool from "../../db.js";

const MAX_HISTORY_MESSAGES = 20;

/**
 * Возвращает историю чата в формате [{ role, content }, ...],
 * отсортированную от старых к новым (как нужно для ИИ).
 */
export async function getChatHistory(chatId, limit = MAX_HISTORY_MESSAGES) {
  try {
    const result = await pool.query(
      `
        SELECT role, content
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [chatId, limit]
    );
    // в БД новые сверху, в ИИ — от старых к новым
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
export async function cleanupChatHistory(
  chatId,
  maxMessages = MAX_HISTORY_MESSAGES
) {
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
 */
export async function saveMessageToMemory(chatId, role, content) {
  if (!content || !content.trim()) return;

  try {
    // Берём последнее сообщение в этом чате
    const lastRes = await pool.query(
      `
        SELECT role, content
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT 1
      `,
      [chatId]
    );

    const last = lastRes.rows[0];
    if (last && last.role === role && last.content === content) {
      // Точно такой же текст уже последним — дубль не записываем
      return;
    }

    await pool.query(
      `
        INSERT INTO chat_memory (chat_id, role, content)
        VALUES ($1, $2, $3)
      `,
      [chatId, role, content]
    );
  } catch (err) {
    console.error("❌ saveMessageToMemory DB error:", err);
  }
}

/**
 * Сохраняем связку пользователь + ассистент как пару сообщений.
 */
export async function saveChatPair(chatId, userText, assistantText) {
  try {
    // Сначала пользователь, потом ассистент — аккуратная история диалога
    await saveMessageToMemory(chatId, "user", userText);
    await saveMessageToMemory(chatId, "assistant", assistantText);

    // ВАЖНО: больше не чистим историю. Долговременная память накапливается.
    // await cleanupChatHistory(chatId, MAX_HISTORY_MESSAGES);
  } catch (err) {
    console.error("❌ saveChatPair DB error:", err);
  }
}
