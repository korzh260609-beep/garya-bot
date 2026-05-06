// AGENT NOTE:
// SG 2.0 minimal Telegram adapter.
// Purpose: attach Telegram events and delegate event handling to focused transport modules.
// Do not add AI, memory, source, task, billing, or permission policy logic here.

import { handleTelegramCallbackQuery } from "./telegramCallbackHandler.js";
import { handleTelegramMessage } from "./telegramMessageHandler.js";

export class TelegramAdapter {
  constructor({ bot } = {}) {
    this.bot = bot || null;
    this.attached = false;
  }

  attach() {
    if (this.attached) {
      console.warn("TelegramAdapter already attached. Skipping duplicate attach.");
      return;
    }

    if (!this.bot) {
      throw new Error("TelegramAdapter.attach: bot is missing");
    }

    this.bot.on("message", async (message) => {
      await handleTelegramMessage({ bot: this.bot, message });
    });

    this.bot.on("callback_query", async (callbackQuery) => {
      await handleTelegramCallbackQuery({ bot: this.bot, callbackQuery });
    });

    this.attached = true;
    console.log("TelegramAdapter attached for SG 2.0.");
  }
}
