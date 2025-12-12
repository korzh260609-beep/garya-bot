// logging/interactionLogs.js
// Логирование взаимодействий в таблицу interaction_logs + file_intake_logs (7F.10)

import pool from "../../db.js";

/**
 * Логируем факт взаимодействия с пользователем (старый лог — НЕ ломаем).
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
 * 7F.10 — отдельная таблица для логов File-Intake
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
 * Запись события File-Intake
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

/**
 * Чтение последних логов File-Intake (для команды /file_logs)
 */
export async function getRecentFileIntakeLogs(limit = 10) {
  try {
    const n = Math.max(1, Math.min(Number(limit) || 10, 30));
    const res = await pool.query(
      `
      SELECT id, created_at, chat_id, message_id, kind,
             has_text, should_call_ai, direct_reply,
             processed_text_chars, ai_called, ai_error,
             file_name, mime_type, file_size
      FROM file_intake_logs
      ORDER BY id DESC
      LIMIT $1
      `,
      [n]
    );
    return res.rows || [];
  } catch (err) {
    console.error("❌ Error in getRecentFileIntakeLogs:", err);
    return [];
  }
}
