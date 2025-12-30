// ============================================================================
// === index.js — SG (Советник GARYA) : Express + Telegram Webhook + Commands ===
// ============================================================================

import { initTelegramTransport } from "./src/bot/telegramTransport.js";

// ✅ NEW: extracted main handler
import { attachMessageRouter } from "./src/bot/messageRouter.js";

// === HTTP SERVER (extracted) ===
import { createApp, startHttpServer } from "./src/http/server.js";

// === CORE ===
import { getAnswerMode, setAnswerMode } from "./core/answerMode.js";
import { loadProjectContext } from "./core/projectContext.js";

// === SYSTEM PROMPT ===
import { buildSystemPrompt } from "./systemPrompt.js";

// === MEMORY ===
import {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
} from "./src/memory/chatMemory.js";

// === USERS ===
import { ensureUserProfile } from "./src/users/userProfile.js";
import { can } from "./src/users/permissions.js";

// === access_requests ===
import * as AccessRequests from "./src/users/accessRequests.js";

// === TASK ENGINE ===
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
  updateTaskStatus,
} from "./src/tasks/taskEngine.js";

// === SOURCES LAYER ===
import {
  ensureDefaultSources,
  runSourceDiagnosticsOnce,
  getAllSourcesSafe,
  fetchFromSourceKey,
  formatSourcesList,
  diagnoseSource,
  testSource,
} from "./src/sources/sources.js";

// === COINGECKO (V1 SIMPLE PRICE) ===
import {
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
} from "./src/sources/coingecko/index.js";

// === FILE-INTAKE / MEDIA ===
import * as FileIntake from "./src/media/fileIntake.js";

// === LOGGING (interaction_logs) ===
import { logInteraction } from "./src/logging/interactionLogs.js";

// === ROBOT MOCK-LAYER ===
import { startRobotLoop } from "./src/robot/robotMock.js";

// === AI ===
import { callAI } from "./ai.js";

// === PROJECT MEMORY ===
import { getProjectSection, upsertProjectSection } from "./projectMemory.js";

// === DB ===
import pool from "./db.js";

import { initSystem } from "./src/bootstrap/initSystem.js";

import { runDiagnostics } from "./diagnostics/diagnostics.js";

import {
  parseCommand,
  firstWordAndRest,
  callWithFallback,
  isOwnerTaskRow,
  canStopTaskV1,
  sanitizeNonMonarchReply,
  getSystemHealth,
} from "./core/helpers.js";

// ============================================================================
// === CONSTANTS / CONFIG ===
// ============================================================================
const MAX_HISTORY_MESSAGES = 20;

// MONARCH by chat_id (Telegram user id)
const MONARCH_CHAT_ID = (process.env.MONARCH_CHAT_ID || "677128443").toString();

// Plans placeholder
const DEFAULT_PLAN = "free";

// ============================================================================
// === HELPERS ===
// ============================================================================
function isMonarch(chatIdStr) {
  return chatIdStr === MONARCH_CHAT_ID;
}

/**
 * Парсер команд Telegram:
 * - cmd: "/pm_set"
 * - rest: "roadmap\n...." (сохраняем переносы строк)
 */

// ⚠️ SAFETY: top-level await опасен (может валить старт до ensure*Table)
// Индексы создаём внутри init в app.listen() после ensure таблиц.
/*
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_project_memory_key_section_created
    ON project_memory (project_key, section, created_at);
  `);
*/

/**
 * 7F.10 — FILE-INTAKE LOGS (самодостаточно в index.js)
 * Таблица:
 * - фиксируем решения: hasText / shouldCallAI / direct / aiCalled / aiError
 * - мета: jsonb (не ломает скелет, можно расширять без миграций)
 */

// ⚠️ SAFETY: top-level await опасен (может валить старт до ensure*Table)
// Индексы создаём внутри init в app.listen() после ensure таблиц.
/*
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_file_intake_logs_chat_created
    ON file_intake_logs (chat_id, created_at DESC);
  `);
*/
      
// ============================================================================
// === EXPRESS SERVER ===
// ============================================================================
const app = createApp();
const bot = initTelegramTransport(app);

const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.status(200).json(getSystemHealth());
});

// ============================================================================
// === START SERVER + INIT SYSTEM ===
// ============================================================================
startHttpServer(app, PORT);

(async () => {
  try {
    await initSystem({ bot });
  } catch (e) {
    console.error("❌ ERROR при инициализации системы:", e);
  }
})();

// ============================================================================
// === MAIN HANDLER (EXTRACTED) ===
// ============================================================================
attachMessageRouter({
  bot,
  MONARCH_CHAT_ID,
  DEFAULT_PLAN,
  MAX_HISTORY_MESSAGES,
});

/*
// ============================================================================
// === MAIN HANDLER: COMMANDS + CHAT + AI ===
// ============================================================================
// (Старый блок оставлен как rollback. НЕ включать.)
// bot.on("message", async (msg) => {
//   ...
// });
*/

console.log("🤖 SG (GARYA AI Bot) работает…");
