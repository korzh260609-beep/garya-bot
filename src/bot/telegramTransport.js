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

  // ✅ CRITICAL: Telegram setWebHook() may validate URL immediately.
  // If Express is not listening yet, setWebHook fails with AggregateError.
  // So we delay first attempt slightly to let server start.
  const INITIAL_DELAY_MS = Number(
    process.env.WEBHOOK_SET_INITIAL_DELAY_MS || 7000
  );

  // ✅ Severity policy: first N days = warn, after that = error
  const WEBHOOK_WARN_DAYS = Number(process.env.WEBHOOK_WARN_DAYS || 2);

  let attempt = 0;

  async function computeWebhookSetSeverity() {
    // If DB is down or table missing, do not crash. Default to warn.
    try {
      const days = Number.isFinite(WEBHOOK_WARN_DAYS) ? WEBHOOK_WARN_DAYS : 2;
      const res = await pool.query(
        `
        SELECT MIN(created_at) AS first_at
        FROM error_events
        WHERE scope = 'runtime'
          AND event_type = 'WEBHOOK_SET_ERROR'
          AND created_at >= (NOW() - INTERVAL '30 days')
        `
      );

      const firstAt = res?.rows?.[0]?.first_at
        ? new Date(res.rows[0].first_at)
        : null;
      if (!firstAt || Number.isNaN(firstAt.getTime())) return "warn";

      const ageMs = Date.now() - firstAt.getTime();
      const thresholdMs = days * 24 * 60 * 60 * 1000;

      return ageMs < thresholdMs ? "warn" : "error";
    } catch (_) {
      return "warn";
    }
  }

  async function trySetWebhook() {
    attempt += 1;

    try {
      await bot.setWebHook(webhookUrl);
      console.log("🚀 Telegram webhook установлен");
    } catch (err) {
      console.error(
        `❌ Ошибка установки webhook (attempt ${attempt}/${MAX_RETRIES}):`,
        err
      );

      // severity escalation: warn for first N days, error after that
      const severity = await computeWebhookSetSeverity();

      // чистим "EFATAL:" из message, но сохраняем raw в context
      const rawMsg = err?.message || String(err);
      const cleanMsg = String(rawMsg).replace(/^EFATAL:\s*/i, "").slice(0, 4000);

      // Fire-and-forget error event (must never crash)
      Promise.resolve()
        .then(() =>
          errorRepo.write({
            scope: "runtime",
            eventType: "WEBHOOK_SET_ERROR",
            severity,
            message: cleanMsg,
            context: {
              attempt,
              maxRetries: MAX_RETRIES,
              name: err?.name,
              code: err?.code,
              raw_message: rawMsg,
            },
          })
        )
        .catch(() => {});

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 30000);
        setTimeout(trySetWebhook, delay);
      } else {
        console.error(
          "❌ Webhook failed too many times — continuing without exit. Check BASE_URL / Telegram."
        );

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

  // ✅ Start after server likely up
  setTimeout(trySetWebhook, Math.max(0, INITIAL_DELAY_MS));

  app.post(webhookPath, async (req, res) => {
    try {
      await bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error("❌ bot.processUpdate error:", err);

      const rawMsg = err?.message || String(err);
      const cleanMsg = String(rawMsg).replace(/^EFATAL:\s*/i, "").slice(0, 4000);

      Promise.resolve()
        .then(() =>
          errorRepo.write({
            scope: "runtime",
            eventType: "TELEGRAM_PROCESS_UPDATE_ERROR",
            severity: "error",
            message: cleanMsg,
            context: {
              name: err?.name,
              code: err?.code,
              raw_message: rawMsg,
            },
          })
        )
        .catch(() => {});

      res.sendStatus(500);
    }
  });

  return bot;
}
