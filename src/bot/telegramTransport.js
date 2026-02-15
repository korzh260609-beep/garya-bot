// src/bot/telegramTransport.js
// Telegram Transport Layer
// Отвечает ТОЛЬКО за:
// - инициализацию TelegramBot
// - webhook
// - приём update
// - проброс сообщений внутрь системы
// НИКАКОЙ бизнес-логики

import TelegramBot from "node-telegram-bot-api";

export function initTelegramTransport(app) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN not provided");
    process.exit(1);
  }

  const BASE_URL = process.env.BASE_URL;
  if (!BASE_URL) {
    console.error("❌ BASE_URL not provided");
    process.exit(1);
  }

  // Инициализация бота (без polling)
  const bot = new TelegramBot(token, { polling: false });

  // Webhook URL закрыт токеном (НЕ ЛОГИРОВАТЬ URL, ИНАЧЕ ТОКЕН УТЕЧЁТ В ЛОГИ)
  const webhookPath = `/webhook/${token}`;
  const webhookUrl = `${BASE_URL}${webhookPath}`;

  // ✅ IMPORTANT: webhook errors must NOT crash the service (transient network happens)
  const MAX_RETRIES = Number(process.env.WEBHOOK_SET_RETRIES || 10);
  const BASE_DELAY_MS = Number(process.env.WEBHOOK_SET_DELAY_MS || 2000);

  let attempt = 0;

  async function trySetWebhook() {
    attempt += 1;

    try {
      await bot.setWebHook(webhookUrl);
      console.log("🚀 Telegram webhook установлен");
    } catch (err) {
      console.error(`❌ Ошибка установки webhook (attempt ${attempt}/${MAX_RETRIES}):`, err);

      // Do NOT exit. Retry with backoff.
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 30000); // cap 30s
        setTimeout(trySetWebhook, delay);
      } else {
        console.error("❌ Webhook failed too many times — continuing without exit. Check BASE_URL / Telegram.");
      }
    }
  }

  // start async
  trySetWebhook();

  // HTTP endpoint для Telegram
  app.post(webhookPath, async (req, res) => {
    try {
      await bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error("❌ bot.processUpdate error:", err);
      res.sendStatus(500);
    }
  });

  return bot;
}
