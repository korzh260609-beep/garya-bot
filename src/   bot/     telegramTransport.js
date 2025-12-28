// src/bot/telegramTransport.js
// Telegram Transport Layer
// Отвечает ТОЛЬКО за:
// - инициализацию TelegramBot
// - webhook
// - приём update
// - проброс сообщений внутрь системы
// НИКАКОЙ бизнес-логики

import TelegramBot from "node-telegram-bot-api";
// import { handleIncomingMessage } from "./messageRouter.js";

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

  // Webhook URL закрыт токеном
  const webhookPath = `/webhook/${token}`;
  const webhookUrl = `${BASE_URL}${webhookPath}`;

  bot
    .setWebHook(webhookUrl)
    .then(() => {
      console.log(`🚀 Telegram webhook установлен: ${webhookUrl}`);
    })
    .catch((err) => {
      console.error("❌ Ошибка установки webhook:", err);
      process.exit(1);
    });

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

  // Все входящие сообщения → router
  // bot.on("message", async (msg) => {
  //   try {
  //     await handleIncomingMessage(bot, msg);
  //   } catch (err) {
  //     console.error("❌ handleIncomingMessage error:", err);
  //   }
  // });

  return bot;
}
