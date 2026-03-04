// src/transport/telegramAdapter.js
// STAGE 6.4 — TelegramAdapter (THIN)

import { TransportAdapter } from "./TransportAdapter.js";
import { createUnifiedContext } from "./unifiedContext.js";
import { toCoreContextFromUnified } from "./toCoreContext.js";
import { isTransportEnforced } from "./transportConfig.js";

import { handleMessage } from "../core/handleMessage.js";

let attached = false; // ← защита от двойного attach

export class TelegramAdapter extends TransportAdapter {
  constructor({ bot, callAI, deps = null, MAX_HISTORY_MESSAGES = 20 } = {}) {
    super();
    this.bot = bot || null;
    this.callAI = callAI || null;
    this.deps = deps || null;
    this.MAX_HISTORY_MESSAGES = MAX_HISTORY_MESSAGES;
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
      meta: {
        messageId: String(msg?.message_id ?? "")
      }
    });
  }

  async reply(context, message) {
    if (!this.bot) throw new Error("TelegramAdapter.reply: bot is not set");

    const chatId = context?.chatId;
    if (!chatId) throw new Error("TelegramAdapter.reply: context.chatId required");

    await this.bot.sendMessage(chatId, String(message ?? ""));
  }

  attach() {

    if (attached) {
      console.warn("TelegramAdapter.attach: already attached, skipping.");
      return;
    }

    if (!this.bot) {
      console.warn("TelegramAdapter.attach: bot is not set, skipping.");
      return;
    }

    if (!isTransportEnforced()) {
      console.log(
        "TelegramAdapter.attach: TRANSPORT_ENFORCED=false, skipping (messageRouter authoritative)."
      );
      return;
    }

    const deps = this.deps;

    if (!deps || typeof deps.reply !== "function" || typeof deps.callAI !== "function") {
      console.warn("TelegramAdapter.attach: deps missing.");
      return;
    }

    this.bot.on("message", async (msg) => {
      try {

        const unified = this.toContext(msg);

        const coreContext = toCoreContextFromUnified(unified, {
          messageId: msg?.message_id,
          transportChatTypeOverride: String(msg?.chat?.type || "")
        });

        const context = {
          ...coreContext,
          raw: msg,
          deps
        };

        await handleMessage(context);

      } catch (e) {
        console.error("TelegramAdapter message handler failed:", e);
      }
    });

    attached = true;

    console.log("✅ TelegramAdapter attached.");
  }
}

export default TelegramAdapter;
