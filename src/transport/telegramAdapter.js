// src/transport/telegramAdapter.js
// STAGE 6.4 — TelegramAdapter (THIN)
//
// Rules (hard):
// - Adapter is THIN: normalize raw event -> UnifiedContext -> CoreContext, then delegate to core
// - Adapter MUST NOT: check permissions, write memory, call AI directly, run tasks
// - All business logic lives in core.handleMessage (and below)

import { TransportAdapter } from "./TransportAdapter.js";
import { createUnifiedContext } from "./unifiedContext.js";
import { toCoreContextFromUnified } from "./toCoreContext.js";
import { isTransportEnforced } from "./transportConfig.js";

// Core entrypoint
import { handleMessage } from "../core/handleMessage.js";

export class TelegramAdapter extends TransportAdapter {
  /**
   * @param {object} opts
   * @param {object} opts.bot      — node-telegram-bot-api instance
   * @param {Function} opts.callAI — AI call function
   * @param {object} opts.deps     — deps object for core (built outside transport)
   * @param {number} [opts.MAX_HISTORY_MESSAGES]
   */
  constructor({ bot, callAI, deps = null, MAX_HISTORY_MESSAGES = 20 } = {}) {
    super();
    this.bot = bot || null;
    this.callAI = callAI || null;
    this.deps = deps || null;
    this.MAX_HISTORY_MESSAGES = MAX_HISTORY_MESSAGES;
  }

  // -------------------------------------------------------------------------
  // toContext — normalize raw Telegram message into UnifiedContext
  // -------------------------------------------------------------------------
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
        messageId: String(msg?.message_id ?? ""),
      },
    });
  }

  // -------------------------------------------------------------------------
  // reply — send text reply back to user
  // -------------------------------------------------------------------------
  async reply(context, message) {
    if (!this.bot) throw new Error("TelegramAdapter.reply: bot is not set");
    const chatId = context?.chatId;
    if (!chatId) throw new Error("TelegramAdapter.reply: context.chatId required");
    await this.bot.sendMessage(chatId, String(message ?? ""));
  }

  // -------------------------------------------------------------------------
  // attach — wire bot.on("message") -> core.handleMessage
  //
  // Only active when TRANSPORT_ENFORCED=true.
  // Otherwise this method is a no-op (messageRouter remains authoritative).
  // -------------------------------------------------------------------------
  attach() {
    if (!this.bot) {
      console.warn("TelegramAdapter.attach: bot is not set, skipping.");
      return;
    }

    if (!isTransportEnforced()) {
      console.log(
        "TelegramAdapter.attach: TRANSPORT_ENFORCED=false, skipping (messageRouter is authoritative)."
      );
      return;
    }

    const deps = this.deps;
    if (!deps || typeof deps.reply !== "function" || typeof deps.callAI !== "function") {
      console.warn(
        "TelegramAdapter.attach: deps missing, skipping (must provide deps in enforced mode)."
      );
      return;
    }

    this.bot.on("message", async (msg) => {
      try {
        // 1) Normalize raw event -> UnifiedContext
        const unified = this.toContext(msg);

        // 2) Convert to core context shape
        const coreContext = toCoreContextFromUnified(unified, {
          messageId: msg?.message_id,
          transportChatTypeOverride: String(msg?.chat?.type || ""),
        });

        // 3) Attach deps + raw message (needed by handlers)
        const context = {
          ...coreContext,
          raw: msg,
          deps,
        };

        // 4) Delegate to core
        await handleMessage(context);
      } catch (e) {
        console.error("TelegramAdapter.attach message handler failed:", e);
      }
    });

    console.log("✅ TelegramAdapter.attach: wired (TRANSPORT_ENFORCED=true).");
  }
}

export default TelegramAdapter;
