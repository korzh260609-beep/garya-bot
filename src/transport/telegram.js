// AGENT NOTE:
// SG 2.0 Telegram transport module.
// Purpose: receive Telegram webhook updates, normalize text messages, and hand off to core.
// Do not put AI, memory, permissions, source, task, or business logic here.

import TelegramBot from "node-telegram-bot-api";
import { envStr } from "../config/env.js";
import { handleMessage } from "../core/handleMessage.js";

function buildTelegramContext(message) {
  return {
    transport: "telegram",
    chatId: message?.chat?.id == null ? null : String(message.chat.id),
    userId: message?.from?.id == null ? null : String(message.from.id),
    senderId: message?.from?.id == null ? null : String(message.from.id),
    chatType: String(message?.chat?.type || "unknown"),
    text: typeof message?.text === "string" ? message.text : "",
    raw: message,
  };
}

export function initTelegramTransport(app) {
  const token = envStr("BOT_TOKEN", "").trim();

  if (!token) {
    console.warn("SG_TELEGRAM_DISABLED: BOT_TOKEN is not configured.");
    return null;
  }

  const bot = new TelegramBot(token, { polling: false });
  const webhookPath = `/webhook/${token}`;

  app.post(webhookPath, async (req, res) => {
    try {
      await bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error("SG_TELEGRAM_PROCESS_UPDATE_ERROR", {
        message: error?.message || String(error),
      });

      res.sendStatus(500);
    }
  });

  bot.on("message", async (message) => {
    const context = buildTelegramContext(message);

    try {
      const result = await handleMessage(context);

      if (context.chatId && result?.reply) {
        await bot.sendMessage(context.chatId, String(result.reply));
      }
    } catch (error) {
      console.error("SG_TELEGRAM_MESSAGE_ERROR", {
        message: error?.message || String(error),
      });

      if (context.chatId) {
        await bot.sendMessage(
          context.chatId,
          "СГ столкнулся с ошибкой обработки. Нужно проверить runtime logs."
        );
      }
    }
  });

  console.log("SG_TELEGRAM_TRANSPORT_READY");

  return bot;
}
