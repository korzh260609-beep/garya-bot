
// ============================================================================
// === src/codeOutput/codeOutputLogger.js
// === WORKFLOW 4.2: Security Logging for CODE OUTPUT refusals
// ============================================================================

import pool from "../../db.js";

/**
 * Log a CODE OUTPUT refusal to the database
 * @param {object} params
 * @param {string} params.chatId - Telegram chat ID
 * @param {string} params.senderId - Telegram user ID
 * @param {string} params.command - Command name (/code_fullfile, /code_insert)
 * @param {string} params.reason - Refusal reason (BAD_ARGS, SENSITIVE_PATH, etc.)
 * @param {string} [params.path] - File path (if applicable)
 * @param {object} [params.details] - Additional details (JSON)
 * @returns {Promise<number>} - ID of the logged refusal
 */
export async function logCodeOutputRefuse({
  chatId,
  senderId,
  command,
  reason,
  path = null,
  details = {},
}) {
  try {
    const result = await pool.query(
      `
      INSERT INTO code_output_refuses
        (chat_id, sender_id, command, reason, path, details)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [
        String(chatId || ""),
        String(senderId || ""),
        String(command || ""),
        String(reason || ""),
        path ? String(path) : null,
        typeof details === "object" ? details : {},
      ]
    );

    const id = result?.rows?.[0]?.id;
    if (id) {
      console.info("🚫 CODE_OUTPUT_REFUSE logged", {
        id,
        chatId,
        senderId,
        command,
        reason,
        path,
      });
    }

    return id || null;
  } catch (err) {
    console.error("❌ logCodeOutputRefuse error:", err);
    return null;
  }
}

/**
 * Get recent refusals for a chat
 * @param {string} chatId - Telegram chat ID
 * @param {number} [limit] - Number of records to return (default: 10)
 * @returns {Promise<Array>} - Array of refusal records
 */
export async function getCodeOutputRefusals(chatId, limit = 10) {
  try {
    const result = await pool.query(
      `
      SELECT id, chat_id, sender_id, command, reason, path, details, created_at
      FROM code_output_refuses
      WHERE chat_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
      [String(chatId || ""), Math.max(1, Math.min(100, Number(limit) || 10))]
    );

    return result?.rows || [];
  } catch (err) {
    console.error("❌ getCodeOutputRefusals error:", err);
    return [];
  }
}

/**
 * Get refusal statistics by reason
 * @param {number} [hoursBack] - Look back N hours (default: 24)
 * @returns {Promise<Array>} - Array of {reason, count}
 */
export async function getCodeOutputRefusalStats(hoursBack = 24) {
  try {
    const result = await pool.query(
      `
      SELECT reason, COUNT(*) as count
      FROM code_output_refuses
      WHERE created_at > NOW() - INTERVAL '1 hour' * $1
      GROUP BY reason
      ORDER BY count DESC
    `,
      [Math.max(1, Number(hoursBack) || 24)]
    );

    return result?.rows || [];
  } catch (err) {
    console.error("❌ getCodeOutputRefusalStats error:", err);
    return [];
  }
}
