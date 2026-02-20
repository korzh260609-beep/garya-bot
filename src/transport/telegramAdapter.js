import { TransportAdapter } from "./TransportAdapter.js";
import { createUnifiedContext } from "./unifiedContext.js";

/**
 * TelegramAdapter — Stage 6.4 SKELETON
 * Converts Telegram "message" payload to UnifiedContext.
 *
 * IMPORTANT:
 *   Not wired into production yet.
 */
export class TelegramAdapter extends TransportAdapter {
  constructor({ bot } = {}) {
    super();
    this.bot = bot || null;
  }

  toContext(msg) {
    const chatId = msg?.chat?.id ?? null;
    const senderId = msg?.from?.id ?? null;
    const chatType = msg?.chat?.type || "unknown";
    const isPrivate = chatType === "private";
    const text = typeof msg?.text === "string" ? msg.text : "";

    return createUnifiedContext({
      transport: "telegram",
      chatId,
      senderId,
      chatType,
      isPrivate,
      text,
      raw: msg,
    });
  }

  async reply(context, message) {
    if (!this.bot) throw new Error("TelegramAdapter.reply: bot is not set");
    const chatId = context?.chatId;
    if (!chatId) throw new Error("TelegramAdapter.reply: context.chatId required");
    await this.bot.sendMessage(chatId, String(message ?? ""));
  }
}
