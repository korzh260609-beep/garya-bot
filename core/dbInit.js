// ============================================================================
// === core/dbInit.js — DB init helpers (tables + small DB queries)
// ============================================================================

import pool from "../db.js";

// ---------------------------------------------------------------------------
// Project Memory table
// ---------------------------------------------------------------------------
async function ensureProjectMemoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project_memory (
      id BIGSERIAL PRIMARY KEY,
      project_key TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      schema_version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_project_memory_key_section_created
    ON project_memory (project_key, section, created_at);
  `);
}

// ---------------------------------------------------------------------------
// 7F.10 — FILE-INTAKE LOGS
// ---------------------------------------------------------------------------
async function ensureFileIntakeLogsTable() {
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
    ON file_intake_logs (chat_id, created_at DESC);
  `);
}

async function logFileIntakeEvent(chatIdStr, payload) {
  try {
    const {
      messageId = null,
      kind = null,
      fileId = null,
      fileUniqueId = null,
      fileName = null,
      mimeType = null,
      fileSize = null,

      hasText = false,
      shouldCallAI = false,
      directReply = false,

      processedTextChars = 0,

      aiCalled = false,
      aiError = false,

      meta = {},
    } = payload || {};

    await pool.query(
      `
      INSERT INTO file_intake_logs (
        chat_id, message_id, kind, file_id, file_unique_id, file_name, mime_type, file_size,
        has_text, should_call_ai, direct_reply, processed_text_chars,
        ai_called, ai_error, meta
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15
      )
      `,
      [
        chatIdStr,
        messageId,
        kind,
        fileId,
        fileUniqueId,
        fileName,
        mimeType,
        fileSize,

        Boolean(hasText),
        Boolean(shouldCallAI),
        Boolean(directReply),
        Number(processedTextChars) || 0,

        Boolean(aiCalled),
        Boolean(aiError),
        meta || {},
      ]
    );
  } catch (err) {
    console.error("❌ Error in logFileIntakeEvent:", err);
  }
}

async function getRecentFileIntakeLogs(chatIdStr, limit = 10) {
  const n = Math.max(1, Math.min(Number(limit) || 10, 30));
  const res = await pool.query(
    `
    SELECT *
    FROM file_intake_logs
    WHERE chat_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [chatIdStr, n]
  );
  return res.rows || [];
}

// ---------------------------------------------------------------------------
// tasks: small query helper used by /stop_task
// ---------------------------------------------------------------------------
async function getTaskRowById(taskId) {
  const res = await pool.query(
    `
    SELECT id, user_global_id, title, type, status, payload, schedule, last_run, created_at
    FROM tasks
    WHERE id = $1
    LIMIT 1
    `,
    [taskId]
  );
  return res.rows[0] || null;
}

export {
  ensureProjectMemoryTable,
  ensureFileIntakeLogsTable,
  logFileIntakeEvent,
  getRecentFileIntakeLogs,
  getTaskRowById,
};
