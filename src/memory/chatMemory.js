// src/memory/chatMemory.js
// Работа с таблицей chat_memory: чтение истории, очистка, сохранение диалога.
//
// STAGE 7.2 LOGIC: поддержка колонок v2:
// - global_user_id (text)
// - transport (text)
// - metadata (jsonb)
// - schema_version (int)
//
// STAGE 7.5: Anti-dup / Memory consistency guard (no schema changes)
// - pg_advisory_xact_lock на ключ messageId+role (+ identity)
// - dedupe check by (global_user_id/chat_id, transport, role, metadata.messageId, content)

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

async function _withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

function _toIntOrNull(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Возвращает историю чата в формате [{ role, content }, ...],
 * отсортированную от старых к новым (как нужно для ИИ).
 *
 * v2: если передан opts.globalUserId — identity-first reading (STAGE 7.3).
 * 1) пробуем читать по global_user_id + chat_id (чтобы не смешивать разные чаты)
 * 2) если пусто — fallback на chat_id (совместимость)
 */
export async function getChatHistory(chatId, limit = MAX_HISTORY_MESSAGES, opts = {}) {
  try {
    const globalUserId = opts?.globalUserId ?? null;

    // STAGE 7.3: identity-first read (STRICT: within current chat)
    if (globalUserId && chatId) {
      const byGlobal = await pool.query(
        `
          SELECT role, content
          FROM chat_memory
          WHERE chat_id = $1
            AND global_user_id = $2
          ORDER BY id DESC
          LIMIT $3
        `,
        [chatId, globalUserId, limit]
      );

      const rows = (byGlobal.rows || []).reverse().map((row) => ({
        role: row.role,
        content: row.content,
      }));

      if (rows.length > 0) return rows;
      // fallback дальше
    }

    // fallback: старое поведение (chat_id-first)
    if (!chatId) return [];

    const byChat = await pool.query(
      `
        SELECT role, content
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT $2
      `,
      [chatId, limit]
    );

    return (byChat.rows || []).reverse().map((row) => ({
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
 * Сохраняем одно сообщение в память с защитой от дублей.
 *
 * v2: 4-й параметр options (необязательный):
 * {
 *   globalUserId?: string|null,
 *   transport?: string,
 *   metadata?: object,        // ожидаем metadata.messageId от Telegram (см. handler/chat.js)
 *   schemaVersion?: number
 * }
 *
 * STAGE 7.5: Anti-dup guard:
 * - если есть metadata.messageId -> транзакция + pg_advisory_xact_lock
 * - проверяем, не существует ли уже запись с тем же messageId+role (+content)
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

  const messageId = _toIntOrNull(metadata?.messageId);

  try {
    // ---------------------------
    // STAGE 7.5: strong anti-dup path (only when messageId exists)
    // ---------------------------
    if (messageId !== null) {
      const identityKey = globalUserId || String(chatId || "");
      const lockKey = `cm:${transport}:${identityKey}:${String(role || "")}:${String(messageId)}`;

      await _withTx(async (client) => {
        // lock across instances for this message+role (+identity)
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [lockKey]);

        // If already inserted (same msg id + role + content) -> skip
        // NOTE: messageId stored inside metadata jsonb
        const existsRes = await client.query(
          `
            SELECT id
            FROM chat_memory
            WHERE transport = $1
              AND role = $2
              AND content = $3
              AND (
                ($4::text IS NOT NULL AND global_user_id = $4)
                OR ($4::text IS NULL AND chat_id = $5)
              )
              AND (metadata->>'messageId') = $6
            ORDER BY id DESC
            LIMIT 1
          `,
          [transport, role, content, globalUserId, String(chatId || ""), String(messageId)]
        );

        if ((existsRes.rows || []).length > 0) {
          return; // already saved
        }

        // keep old "double подряд" guard as extra safety
        const lastRes = await client.query(
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
          return;
        }

        await client.query(
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
      });

      return;
    }

    // ---------------------------
    // legacy path (no messageId) — keep previous behavior
    // ---------------------------

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
    // ✅ ENHANCED CONTEXT LOG (critical for Render diagnosis)
    try {
      console.error("❌ saveMessageToMemory DB error:", {
        role: String(role || ""),
        chatId: String(chatId || ""),
        globalUserId: globalUserId || null,
        transport,
        schemaVersion,
        messageId: messageId !== null ? messageId : null,
        err: err?.message ? String(err.message) : err,
      });
    } catch (_) {
      console.error("❌ saveMessageToMemory DB error:", err);
    }
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
