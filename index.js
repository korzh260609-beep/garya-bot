// ============================================================================
// === index.js — SG (Советник GARYA) : Express + Telegram Webhook + Bootstrap ===
// ============================================================================

import { initTelegramTransport } from "./src/bot/telegramTransport.js";
import { attachMessageRouter } from "./src/bot/messageRouter.js";

// ✅ STAGE 6 LOGIC STEP 3 — TelegramAdapter (attach when TRANSPORT_ENFORCED=true)
import { TelegramAdapter } from "./src/transport/telegramAdapter.js";

import { createApp, startHttpServer } from "./src/http/server.js";
import { initSystem } from "./src/bootstrap/initSystem.js";

import { getSystemHealth } from "./core/helpers.js";

// ✅ FIX: подключаем callAI и передаём в messageRouter
import { callAI } from "./ai.js";

// ✅ Project Memory write API (needed for /pm_set and /build_info autosave)
import { upsertProjectSection } from "./projectMemory.js";

// ✅ 2.7 JOB QUEUE / WORKERS (SKELETON) — singleton (no circular imports)
import { jobRunner } from "./src/jobs/jobRunnerInstance.js";
export { jobRunner };

// ✅ ROBOT-LAYER loop (mock)
import { startRobotLoop } from "./src/robot/robotMock.js";

// ✅ Stage 3.6: centralized env access (no direct process.env here)
import { envInt, envStr } from "./src/core/config.js";

// ============================================================================
// === CONSTANTS / CONFIG ===
// ============================================================================
const MAX_HISTORY_MESSAGES = 20;

// MONARCH only from ENV (Stage 4 — identity-first, no fallback)
const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();

// Plans placeholder
const DEFAULT_PLAN = "free";

// ============================================================================
// === JOB RUNNER (2.7 SKELETON) ===
// ============================================================================
console.log("🧩 JobRunner initialized (singleton).");

// ============================================================================
// === EXPRESS SERVER ===
// ============================================================================
const app = createApp();
const bot = initTelegramTransport(app);

const PORT = envInt("PORT", 3000);

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

// ✅ STAGE 6 — TelegramAdapter (no-op when TRANSPORT_ENFORCED=false)
const telegramAdapter = new TelegramAdapter({ bot, callAI, MAX_HISTORY_MESSAGES });
telegramAdapter.attach();

console.log("🤖 SG (GARYA AI Bot) работает…");
