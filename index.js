// ============================================================================
// === index.js — SG (Советник GARYA) : Express + Telegram Webhook + Bootstrap ===
// ============================================================================

import { initTelegramTransport } from "./src/bot/telegramTransport.js";
import { attachMessageRouter } from "./src/bot/messageRouter.js";

import { createApp, startHttpServer } from "./src/http/server.js";
import { initSystem } from "./src/bootstrap/initSystem.js";

import { getSystemHealth } from "./core/helpers.js";

// ✅ FIX: подключаем callAI и передаём в messageRouter
import { callAI } from "./ai.js";

// ✅ 2.7 JOB QUEUE / WORKERS (SKELETON)
import { JobRunner } from "./src/jobs/jobRunner.js";

// ============================================================================
// === CONSTANTS / CONFIG ===
// ============================================================================
const MAX_HISTORY_MESSAGES = 20;

// MONARCH by chat_id (Telegram user id)
const MONARCH_USER_ID = (process.env.MONARCH_USER_ID || "677128443").toString();

// Plans placeholder
const DEFAULT_PLAN = "free";

// ============================================================================
// === JOB RUNNER (2.7 SKELETON) ===
// ============================================================================
export const jobRunner = new JobRunner();
console.log("🧩 JobRunner initialized (skeleton).");

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
  callAI, // ✅ FIX
  MAX_HISTORY_MESSAGES,
});

console.log("🤖 SG (GARYA AI Bot) работает…");
