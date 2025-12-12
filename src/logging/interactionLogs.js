// logging/interactionLogs.js
// Логирование взаимодействий в таблицу interaction_logs + file_intake_logs (7F.10)

import pool from "../../db.js";

/**
 * (Старая) логика — оставляем без изменений:
 * Логируем факт взаимодействия с пользователем:
 * - taskType (chat, task, report и т.п.)
 * - aiCostLevel (low / high / robot и т.д.)
 *
 * classification берётся из classifyInteraction.
 */
export async function logInteraction(chatIdStr, classification) {
  try {
    const taskType = classification?.taskType || "chat";
    const aiCostLevel = classification?.aiCostLevel || "low";

    await pool.query(
      `
        INSERT INTO interaction_logs (chat_id, task_type, ai_cost_level)
        VALUES ($1, $2, $3)
      `,
      [chatIdStr, taskType, aiCostLevel]
    );
  } catch (err) {
    console.error("❌ Error in logInteraction:", err);
  }
}

/**
 * 7F.10 — отдельная таблица для логов File-Intake, чтобы:
 * - не зависеть от схемы interaction_logs
 * - не ломать прод при изменениях
 */
export async function ensureFileIntakeLogsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_intake_logs (
        id BIGSERIAL PRIMARY KEY,
        chat_id TEXT NOT NULL,
        message_id BIGINT,
        kind TEXT,
        file_id TEXT,
        file_unique_id TEXT,
        file_name TEXT,
        mime_type TEXT,
        file_size BIGINT,
        has_text BOOLEAN NOT NULL DEFAULT FALSE,
        should_call_ai BOOLEAN NOT NULL DEFAULT FALSE,
        direct_reply BOOLEAN NOT NULL DEFAULT FALSE,
        processed_text_chars INT NOT NULL DEFAULT 0,
        ai_called BOOLEAN NOT NULL DEFAULT FALSE,
        ai_error BOOLEAN NOT NULL DEFAULT FALSE,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_file_intake_logs_chat_created
      ON file_intake_logs (chat_id, created_at);
    `);
  } catch (err) {
    console.error("❌ Error in ensureFileIntakeLogsTable:", err);
  }
}

/**
 * Запись события File-Intake (одна строка на входящее сообщение)
 */
export async function logFileIntakeEvent(chatIdStr, payload = {}) {
  try {
    const p = payload || {};

    await pool.query(
      `
        INSERT INTO file_intake_logs (
          chat_id, message_id, kind,
          file_id, file_unique_id, file_name,
          mime_type, file_size,
          has_text, should_call_ai, direct_reply,
          processed_text_chars,
          ai_called, ai_error,
          meta
        )
        VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8,
          $9, $10, $11,
          $12,
          $13, $14,
          $15::jsonb
        )
      `,
      [
        chatIdStr,
        p.messageId ?? null,
        p.kind ?? null,
        p.fileId ?? null,
        p.fileUniqueId ?? null,
        p.fileName ?? null,
        p.mimeType ?? null,
        p.fileSize ?? null,
        Boolean(p.hasText),
        Boolean(p.shouldCallAI),
        Boolean(p.directReply),
        Number.isFinite(p.processedTextChars) ? p.processedTextChars : 0,
        Boolean(p.aiCalled),
        Boolean(p.aiError),
        JSON.stringify(p.meta || {}),
      ]
    );
  } catch (err) {
    console.error("❌ Error in logFileIntakeEvent:", err);
  }
}
