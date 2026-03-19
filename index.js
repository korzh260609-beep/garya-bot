// ============================================================================
// === index.js — SG (Советник GARYA) : Express + Telegram Webhook + Bootstrap ===
// ============================================================================

import { initTelegramTransport } from "./src/bot/telegramTransport.js";
import { attachMessageRouter } from "./src/bot/messageRouter.js";

// ✅ TelegramAdapter
import { TelegramAdapter } from "./src/transport/telegramAdapter.js";

// ✅ STAGE 6.9 — deps factory (core wiring, not transport)
import { buildCoreDeps } from "./src/core/coreDepsFactory.js";

// ✅ Stage 6 — transport enforced flag
import { isTransportEnforced } from "./src/transport/transportConfig.js";

import { createApp, startHttpServer } from "./src/http/server.js";
import { createDebugCoingeckoMarketChartRoute } from "./src/http/debugCoingeckoMarketChartRoute.js";
import { createDebugCoingeckoIndicatorsRoute } from "./src/http/debugCoingeckoIndicatorsRoute.js";
import { createDebugCoingeckoIndicatorsReaderRoute } from "./src/http/debugCoingeckoIndicatorsReaderRoute.js";
import { createDebugCoingeckoIndicatorsSnapshotRoute } from "./src/http/debugCoingeckoIndicatorsSnapshotRoute.js";
import { createDebugCryptoNewsRssRoute } from "./src/http/debugCryptoNewsRssRoute.js";
import { initSystem } from "./src/bootstrap/initSystem.js";

import { getSystemHealth } from "./core/helpers.js";

// AI
import { callAI } from "./ai.js";

// Project memory
import { upsertProjectSection } from "./projectMemory.js";

// Job runner
import { jobRunner } from "./src/jobs/jobRunnerInstance.js";
export { jobRunner };

// Env
import { envInt } from "./src/core/config.js";

// ============================================================================
// CONFIG
// ============================================================================
const MAX_HISTORY_MESSAGES = 20;

// ============================================================================
// JOB RUNNER
// ============================================================================
console.log("🧩 JobRunner initialized (singleton).");

// ============================================================================
// EXPRESS SERVER
// ============================================================================
const app = createApp();
const bot = initTelegramTransport(app);

const PORT = envInt("PORT", 3000);

app.get("/health", (req, res) => {
  res.status(200).json(getSystemHealth());
});

// ============================================================================
// TEMP DEBUG ROUTES — STAGE 10C.5 / 10C.6 / 10C.29 / 10C.35 / 10C.8 CHECK
// IMPORTANT:
// - routes themselves are protected internally by env + token
// - this only mounts the routes
// ============================================================================
app.use(createDebugCoingeckoMarketChartRoute());
app.use(createDebugCoingeckoIndicatorsRoute());
app.use(createDebugCoingeckoIndicatorsReaderRoute());
app.use(createDebugCoingeckoIndicatorsSnapshotRoute());
app.use(createDebugCryptoNewsRssRoute());

// ============================================================================
// START SERVER
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
// MAIN HANDLER
// ============================================================================

// Router only when transport NOT enforced
if (!isTransportEnforced()) {
  attachMessageRouter({
    bot,
    callAI,
    upsertProjectSection,
    MAX_HISTORY_MESSAGES,
  });
} else {
  console.log(
    "🧭 Transport enforced: messageRouter is NOT attached (TelegramAdapter is authoritative)."
  );
}

// ============================================================================
// TELEGRAM ADAPTER
// ============================================================================

const telegramAdapter = new TelegramAdapter({
  bot,
  callAI,
  MAX_HISTORY_MESSAGES,
});

// reply wrapper (adapter reply)
const reply = (ctx, text) => telegramAdapter.reply(ctx, text);

// build deps in CORE layer (not transport)
telegramAdapter.deps = buildCoreDeps({
  bot,
  callAI,
  reply,
  MAX_HISTORY_MESSAGES,
});

// attach adapter
telegramAdapter.attach();

console.log("🤖 SG (GARYA AI Bot) работает…");