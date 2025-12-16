// src/media/fileIntakeLogs.js
import { pool } from "../../db.js";

/**
 * Ensure file_intake_logs table
 */
export async function ensureFileIntakeLogsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_intake_logs (
      id SERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

/**
 * Log file intake event
 */
export async function logFileIntakeEvent(chatIdStr, payload) {
  await pool.query(
    `INSERT INTO file_intake_logs (chat_id, payload) VALUES ($1, $2)`,
    [chatIdStr, payload]
  );
}

/**
 * Get recent file intake logs
 */
export async function getRecentFileIntakeLogs(chatIdStr, limit = 5) {
  const res = await pool.query(
    `
    SELECT payload, created_at
    FROM file_intake_logs
    WHERE chat_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [chatIdStr, limit]
  );
  return res.rows;
}

