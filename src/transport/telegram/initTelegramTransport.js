// AGENT NOTE:
// SG 2.0 minimal Telegram webhook transport.
// Purpose: initialize Telegram bot webhook and pass raw updates into Telegram's SDK.
// Do not add AI, memory, permissions, source, task, or business logic here.

import TelegramBot from "node-telegram-bot-api";
import { envIntRange, getPublicBaseUrl, getTelegramBotToken } from "../../config/env.js";

export function initTelegramTransport(app) {
  const token = getTelegramBotToken();

  if (!token) {
    console.warn("SG_TELEGRAM_DISABLED: BOT_TOKEN or TELEGRAM_BOT_TOKEN is not configured.");
    return null;
  }

  const baseUrl = getPublicBaseUrl();
  const bot = new TelegramBot(token, { polling: false });
  const webhookPath = `/webhook/${token}`;

  const maxRetries = envIntRange("WEBHOOK_SET_RETRIES", 10, { min: 1, max: 100 });
  const baseDelayMs = envIntRange("WEBHOOK_SET_DELAY_MS", 2000, { min: 100, max: 60000 });
  const initialDelayMs = envIntRange("WEBHOOK_SET_INITIAL_DELAY_MS", 7000, { min: 0, max: 120000 });

  if (baseUrl) {
    const webhookUrl = `${baseUrl}${webhookPath}`;
    let attempt = 0;

    const trySetWebhook = async () => {
      attempt += 1;

      try {
        const info = await bot.getWebHookInfo().catch(() => null);

        if (info?.url && String(info.url) === String(webhookUrl)) {
          console.log("Telegram webhook already configured for SG 2.0.");
          return;
        }

        await bot.setWebHook(webhookUrl);
        console.log("Telegram webhook configured for SG 2.0.");
      } catch (error) {
        console.error(
          `Telegram webhook setup failed (attempt ${attempt}/${maxRetries}):`,
          error?.message || String(error)
        );

        if (attempt < maxRetries) {
          const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30000);
          setTimeout(trySetWebhook, delay);
        } else {
          console.error("Telegram webhook setup gave up after max retries. Check BASE_URL and Telegram token.");
        }
      }
    };

    setTimeout(trySetWebhook, Math.max(0, initialDelayMs));
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
