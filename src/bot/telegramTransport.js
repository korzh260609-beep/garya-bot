// src/bot/telegramTransport.js
// Telegram Transport Layer
// Отвечает ТОЛЬКО за:
// - инициализацию TelegramBot
// - webhook
// - приём update
// - проброс сообщений внутрь системы
// НИКАКОЙ бизнес-логики

import TelegramBot from "node-telegram-bot-api";
import pool from "../../db.js";
import { ErrorEventsRepo } from "../db/errorEventsRepo.js";

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

  const bot = new TelegramBot(token, { polling: false });

  // Webhook URL закрыт токеном (НЕ ЛОГИРОВАТЬ URL, ИНАЧЕ ТОКЕН УТЕЧЁТ В ЛОГИ)
  const webhookPath = `/webhook/${token}`;
  const webhookUrl = `${BASE_URL}${webhookPath}`;

  const errorRepo = new ErrorEventsRepo(pool);

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

      // Fire-and-forget error event (must never crash)
      Promise.resolve()
        .then(() =>
          errorRepo.write({
            scope: "runtime",
            eventType: "WEBHOOK_SET_ERROR",
            severity: "error",
            message: err?.message || String(err),
            context: {
              attempt,
              maxRetries: MAX_RETRIES,
              name: err?.name,
              code: err?.code,
            },
          })
        )
        .catch(() => {});

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 30000);
        setTimeout(trySetWebhook, delay);
      } else {
        console.error("❌ Webhook failed too many times — continuing without exit. Check BASE_URL / Telegram.");

        Promise.resolve()
          .then(() =>
            errorRepo.write({
              scope: "runtime",
              eventType: "WEBHOOK_SET_GIVEUP",
              severity: "warn",
              message: "Webhook failed too many times (give up retries).",
              context: { maxRetries: MAX_RETRIES },
            })
          )
          .catch(() => {});
      }
    }
  }

  trySetWebhook();

  app.post(webhookPath, async (req, res) => {
    try {
      await bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error("❌ bot.processUpdate error:", err);

      Promise.resolve()
        .then(() =>
          errorRepo.write({
            scope: "runtime",
            eventType: "TELEGRAM_PROCESS_UPDATE_ERROR",
            severity: "error",
            message: err?.message || String(err),
            context: {
              name: err?.name,
              code: err?.code,
            },
          })
        )
        .catch(() => {});

      res.sendStatus(500);
    }
  });

  return bot;
}
