// AGENT NOTE:
// SG 2.0 Telegram transport compatibility wrapper.
// Purpose: keep the public transport import stable while implementation lives in modular files.
// Do not add AI, memory, permissions, source, task, or business logic here.

import { initTelegramTransport as initTelegramWebhookTransport } from "./telegram/initTelegramTransport.js";
import { TelegramAdapter } from "./telegram/telegramAdapter.js";

export function initTelegramTransport(app) {
  const bot = initTelegramWebhookTransport(app);

  if (!bot) {
    return null;
  }

  const adapter = new TelegramAdapter({ bot });
  adapter.attach();

  return bot;
}
