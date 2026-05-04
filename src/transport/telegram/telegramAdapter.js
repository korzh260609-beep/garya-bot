// AGENT NOTE:
// SG 2.0 minimal Telegram adapter.
// Purpose: convert Telegram messages into normalized core context and delegate prepared replies to delivery.
// Do not add AI, memory, source, task, billing, or permission policy logic here.

import { handleMessage } from "../../core/handleMessage.js";
import { sendTelegramReply } from "../../delivery/telegramDelivery.js";

let attached = false;

export class TelegramAdapter {
  constructor({ bot } = {}) {
    this.bot = bot || null;
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

  async reply(context, text) {
    await sendTelegramReply({
      bot: this.bot,
      context,
      text,
    });
  }

  attach() {
    if (attached) {
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
        await this.reply(context, result?.reply || "СГ не смог сформировать ответ.");
      } catch (error) {
        console.error("TelegramAdapter message handling failed:", error?.message || String(error));
        await this.reply(context, "СГ столкнулся с ошибкой обработки. Нужно проверить конфигурацию и логи.");
      }
    });

    attached = true;
    console.log("TelegramAdapter attached for SG 2.0.");
  }
}
