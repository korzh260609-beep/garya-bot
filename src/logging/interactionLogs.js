// logging/interactionLogs.js
// Логирование взаимодействий в таблицу interaction_logs.

import pool from "../db.js";

/**
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

