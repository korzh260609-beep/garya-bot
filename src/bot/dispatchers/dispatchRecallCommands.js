// src/bot/dispatchers/dispatchRecallCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleRecall, handleRecallMore } from "../handlers/recall.js";

export async function dispatchRecallCommands({ cmd0, ctx }) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/recall": {
      await handleRecall({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        isPrivateChat: !!ctx.isPrivateChat,
        senderIdStr: ctx.senderIdStr ?? null,
        chatType: ctx.chatType ?? null,
        identityCtx: ctx.identityCtx ?? null,
      });
      return { handled: true };
    }

    case "/recall_more": {
      await handleRecallMore({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        isPrivateChat: !!ctx.isPrivateChat,
        senderIdStr: ctx.senderIdStr ?? null,
        chatType: ctx.chatType ?? null,
        identityCtx: ctx.identityCtx ?? null,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}