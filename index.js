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

// ✅ Project Memory write API (needed for /pm_set and /build_info autosave)
import { upsertProjectSection } from "./projectMemory.js";

// ✅ 2.7 JOB QUEUE / WORKERS (SKELETON)
import { JobRunner } from "./src/jobs/jobRunner.js";

// ✅ ROBOT-LAYER loop (mock)
import { startRobotLoop } from "./src/robot/robotMock.js";

// ============================================================================
// === CONSTANTS / CONFIG ===
// ============================================================================
const MAX_HISTORY_MESSAGES = 20;

// MONARCH only from ENV (Stage 4 — identity-first, no fallback)
const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();

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

    // ✅ START ROBOT LOOP (needed to produce task_runs)
    startRobotLoop(bot);
    console.log("🤖 Robot loop started.");
  } catch (e) {
    console.error("❌ ERROR при инициализации системы:", e);
  }
})();

// ============================================================================
// === MAIN HANDLER (EXTRACTED) ===
// ============================================================================
attachMessageRouter({
  bot,
  callAI,
  upsertProjectSection,
  MAX_HISTORY_MESSAGES,
});

console.log("🤖 SG (GARYA AI Bot) работает…");
