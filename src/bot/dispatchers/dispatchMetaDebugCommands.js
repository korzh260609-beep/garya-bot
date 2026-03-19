// src/bot/dispatchers/dispatchMetaDebugCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleChatMetaDebug } from "../handlers/chatMetaDebug.js";
import { handleWebhookInfo } from "../handlers/webhookInfo.js";
import { handleBehaviorEventsLast } from "../handlers/behaviorEventsLast.js";
import { handleBeEmit } from "../handlers/beEmit.js";

export async function dispatchMetaDebugCommands({ cmd0, ctx }) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/chat_meta_debug": {
      await handleChatMetaDebug({
        bot,
        chatId,
        chatIdStr,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/webhook_info": {
      await handleWebhookInfo({ bot, chatId });
      return { handled: true };
    }

    case "/behavior_events_last": {
      await handleBehaviorEventsLast({
        bot,
        chatId,
        rest: ctx.rest,
        senderIdStr: ctx.senderIdStr,
      });
      return { handled: true };
    }

    case "/be_emit": {
      await handleBeEmit({
        bot,
        chatId,
        rest: ctx.rest,
        senderIdStr: ctx.senderIdStr,
        chatIdStr,
        transport: ctx?.identityCtx?.transport || "telegram",
        globalUserId: ctx?.user?.global_user_id ?? null,
        bypass: !!ctx.bypass,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}