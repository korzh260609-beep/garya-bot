// AGENT NOTE:
// SG 2.0 minimal Telegram adapter.
// Purpose: convert Telegram messages into normalized core context and delegate prepared replies to delivery.
// Do not add AI, memory, source, task, billing, or permission policy logic here.

import { handleGithubApprovalCallback } from "../../core/githubApprovalHandler.js";
import { handleMessage } from "../../core/handleMessage.js";
import {
  sendTelegramGithubApprovalReply,
  sendTelegramReply,
} from "../../delivery/telegramDelivery.js";

export class TelegramAdapter {
  constructor({ bot } = {}) {
    this.bot = bot || null;
    this.attached = false;
  }

  toContext(message) {
    return {
      transport: "telegram",
      chatId: message?.chat?.id ?? null,
      userId: message?.from?.id ?? null,
      senderId: message?.from?.id ?? null,
      chatType: message?.chat?.type || "unknown",
      text: typeof message?.text === "string" ? message.text : "",
      raw: message,
    };
  }

  toCallbackContext(callbackQuery) {
    const message = callbackQuery?.message || {};

    return {
      transport: "telegram",
      chatId: message?.chat?.id ?? null,
      userId: callbackQuery?.from?.id ?? null,
      senderId: callbackQuery?.from?.id ?? null,
      chatType: message?.chat?.type || "unknown",
      text: typeof callbackQuery?.data === "string" ? callbackQuery.data : "",
      raw: callbackQuery,
    };
  }

  async reply(context, text, options = {}) {
    await sendTelegramReply({
      bot: this.bot,
      context,
      text,
      options,
    });
  }

  async replyWithGithubApproval(context, text, approvalId) {
    await sendTelegramGithubApprovalReply({
      bot: this.bot,
      context,
      text,
      approvalId,
    });
  }

  async answerCallback(callbackQuery, text = "") {
    if (!callbackQuery?.id) return;

    try {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: String(text || ""),
        show_alert: false,
      });
    } catch (error) {
      console.warn("TelegramAdapter callback answer failed:", error?.message || String(error));
    }
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
      const context = this.toContext(message);

      try {
        const result = await handleMessage(context);

        if (result?.githubApproval?.approvalId) {
          await this.replyWithGithubApproval(
            context,
            result?.reply || "Подтверждение GitHub-действия требуется.",
            result.githubApproval.approvalId
          );
          return;
        }

        await this.reply(context, result?.reply || "Я не смог сформировать ответ.");
      } catch (error) {
        console.error("TelegramAdapter message handling failed:", error?.message || String(error));
        await this.reply(context, "Я не смог обработать сообщение. Нужно проверить внутреннее состояние SG.");
      }
    });

    this.bot.on("callback_query", async (callbackQuery) => {
      const context = this.toCallbackContext(callbackQuery);

      try {
        const result = await handleGithubApprovalCallback(context, callbackQuery?.data || "");

        if (!result?.handled) {
          await this.answerCallback(callbackQuery, "Неизвестное действие.");
          return;
        }

        await this.answerCallback(callbackQuery, result.ok ? "Готово" : "Ошибка");
        await this.reply(context, result?.reply || "GitHub-действие обработано.");
      } catch (error) {
        console.error("TelegramAdapter callback handling failed:", error?.message || String(error));
        await this.answerCallback(callbackQuery, "Ошибка");
        await this.reply(context, "Я не смог обработать кнопку. Нужно проверить внутреннее состояние SG.");
      }
    });

    this.attached = true;
    console.log("TelegramAdapter attached for SG 2.0.");
  }
}
