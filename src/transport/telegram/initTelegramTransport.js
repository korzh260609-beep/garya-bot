// AGENT NOTE:
// SG 2.0 minimal Telegram webhook transport.
// Purpose: initialize Telegram bot webhook and pass raw updates into Telegram's SDK.
// Do not add AI, memory, permissions, source, task, or business logic here.

import TelegramBot from "node-telegram-bot-api";
import { envStr, getPublicBaseUrl } from "../../config/env.js";

export function initTelegramTransport(app) {
  const token = envStr("BOT_TOKEN", "").trim();

  if (!token) {
    console.warn("SG_TELEGRAM_DISABLED: BOT_TOKEN is not configured.");
    return null;
  }

  const baseUrl = getPublicBaseUrl();
  const bot = new TelegramBot(token, { polling: false });
  const webhookPath = `/webhook/${token}`;

  if (baseUrl) {
    const webhookUrl = `${baseUrl}${webhookPath}`;

    bot.setWebHook(webhookUrl)
      .then(() => {
        console.log("Telegram webhook configured for SG 2.0.");
      })
      .catch((error) => {
        console.error("Telegram webhook setup failed:", error?.message || String(error));
      });
  } else {
    console.warn("Telegram webhook was not configured: BASE_URL or Render external URL is missing.");
  }

  app.post(webhookPath, async (req, res) => {
    try {
      await bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error("Telegram update processing failed:", error?.message || String(error));
      res.sendStatus(500);
    }
  });

  return bot;
}
