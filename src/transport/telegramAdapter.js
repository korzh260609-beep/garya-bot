// src/transport/telegramAdapter.js
// STAGE 6.4 — TelegramAdapter
//
// Evolution:
//   v1: SKELETON — toContext() + reply() contract only
//   v2: STAGE 6 LOGIC STEP 3 — deps injection + attach() method
//
// attach() wires bot.on("message") -> handleMessage(context + deps)
// This replaces attachMessageRouter() when TRANSPORT_ENFORCED=true.
//
// TRANSPORT RULES (hard):
//   - Adapter is THIN: normalize raw event -> UnifiedContext + deps, then delegate to core
//   - Adapter MUST NOT: check permissions, write memory, call AI directly, run tasks
//   - All business logic lives in handleMessage (core)

import { TransportAdapter } from "./TransportAdapter.js";
import { createUnifiedContext } from "./unifiedContext.js";
import { toCoreContextFromUnified } from "./toCoreContext.js";
import { isTransportEnforced } from "./transportConfig.js";

// Core entrypoint
import { handleMessage } from "../core/handleMessage.js";

// Deps that adapter assembles and injects into context
import { dispatchCommand } from "../bot/commandDispatcher.js";
import { handleChatMessage } from "../bot/handlers/chat.js";
import { getChatHistory } from "../bot/memory/memoryBridge.js";
import { getAnswerMode, setAnswerMode } from "../../core/answerMode.js";
import { loadProjectContext } from "../../core/projectContext.js";
import { buildSystemPrompt } from "../../systemPrompt.js";
import { logInteraction } from "../logging/interactionLogs.js";
import { sanitizeNonMonarchReply } from "../../core/helpers.js";
import * as FileIntake from "../media/fileIntake.js";
import {
  getCoinGeckoSimplePriceById,
  getCoinGeckoSimplePriceMulti,
} from "../sources/coingecko/index.js";
import {
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
  getTaskById,
  runTaskWithAI,
  updateTaskStatus,
} from "../tasks/taskEngine.js";

export class TelegramAdapter extends TransportAdapter {
  /**
   * @param {object} opts
   * @param {object} opts.bot     — node-telegram-bot-api instance
   * @param {Function} opts.callAI — AI call function
   * @param {number} [opts.MAX_HISTORY_MESSAGES]
   */
  constructor({ bot, callAI, MAX_HISTORY_MESSAGES = 20 } = {}) {
    super();
    this.bot = bot || null;
    this.callAI = callAI || null;
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
  // buildDeps — assemble all dependencies for handleMessage
  // IMPORTANT: deps are plain objects/functions, NOT business logic
  // -------------------------------------------------------------------------
  buildDeps() {
    const adapter = this;

    return {
      // reply via adapter (thin wrapper)
      reply: (ctx, text) => adapter.reply(ctx, text),

      // AI call
      callAI: this.callAI,

      // raw bot (for handlers that still need it directly)
      bot: this.bot,

      // command dispatcher
      dispatchCommand,

      // chat/AI handler
      handleChatMessage,

      // memory
      getChatHistory,

      // answer mode
      getAnswerMode,
      setAnswerMode,

      // project context + system prompt
      loadProjectContext,
      buildSystemPrompt,

      // logging
      logInteraction,

      // reply sanitizer
      sanitizeNonMonarchReply,

      // file intake
      FileIntake,

      // coingecko
      getCoinGeckoSimplePriceById,
      getCoinGeckoSimplePriceMulti,

      // tasks
      getUserTasks,
      getTaskById,
      runTaskWithAI,
      updateTaskStatus,
      createDemoTask,
      createManualTask,
      createTestPriceMonitorTask,

      // config
      MAX_HISTORY_MESSAGES: this.MAX_HISTORY_MESSAGES,
    };
  }

  // -------------------------------------------------------------------------
  // attach — wire bot.on("message") -> handleMessage
  //
  // IMPORTANT:
  //   Only active when TRANSPORT_ENFORCED=true.
  //   Otherwise this method is a no-op (messageRouter remains authoritative).
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

    const deps = this.buildDeps();

    this.bot.on("message", async (msg) => {
      try {
        // 1. Normalize raw event -> UnifiedContext
        const unified = this.toContext(msg);

        // 2. Convert to core context shape
        const coreContext = toCoreContextFromUnified(unified, {
          messageId: msg.message_id,
          transportChatTypeOverride: String(msg.chat?.type || ""),
        });

        // 3. Attach deps + raw message (needed by handlers)
        const context = {
          ...coreContext,
          raw: msg,
          deps,
        };

        // 4. Delegate to core
        await handleMessage(context);
      } catch (e) {
        console.error("TelegramAdapter.attach message handler failed:", e);
      }
    });

    console.log("✅ TelegramAdapter.attach: wired (TRANSPORT_ENFORCED=true).");
  }
}
