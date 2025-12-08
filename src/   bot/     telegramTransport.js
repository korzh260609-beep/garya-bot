// bot/telegramTransport.js
// Инициализация TelegramBot + webhook + приём обновлений.
// Этот модуль отвечает только за транспорт: получение апдейтов и проброс в messageRouter.

import TelegramBot from "node-telegram-bot-api";
import { handleIncomingMessage } from "./messageRouter.js";

export function initTelegramTransport(app) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN not provided");
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: false });

  const BASE_URL = process.env.BASE_URL;
  if (!BASE_URL) {
    console.error("❌ BASE_URL not provided");
    process.exit(1);
  }

  const webhookUrl = `${BASE_URL}/webhook`;

  // Устанавливаем вебхук
  bot
    .setWebHook(webhookUrl)
    .then(() => console.log(`🚀 Webhook установлен: ${webhookUrl}`))
    .catch((err) =>
      console.error("❌ Ошибка установки webhook Telegram:", err)
    );

  // Маршрут для приёма webhook
  app.post("/webhook", async (req, res) => {
    try {
      await bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error("❌ processUpdate error:", err);
      res.sendStatus(500);
    }
  });

  // Обработчик всех сообщений — пробрасываем внутрь messageRouter
  bot.on("message", async (msg) => {
    try {
      await handleIncomingMessage(bot, msg);
    } catch (err) {
      console.error("❌ Ошибка в handleIncomingMessage:", err);
    }
  });

  return bot;
}

