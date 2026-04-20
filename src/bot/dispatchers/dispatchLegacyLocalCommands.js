// src/bot/dispatchers/dispatchLegacyLocalCommands.js
// ============================================================================
// LEGACY / LOCAL COMMANDS DISPATCHER
// - extracted 1:1 from commandDispatcher
// - NO logic changes
// - ONLY routing isolation
// ============================================================================

import { handleArList } from "../handlers/arList.js";

export async function dispatchLegacyLocalCommands({ cmd0, ctx }) {
  const { bot, chatId } = ctx;

  switch (cmd0) {
    case "/ar_list": {
      await handleArList({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/help": {
      if (typeof ctx.handleHelpLegacy !== "function") {
        return { handled: false };
      }

      await ctx.handleHelpLegacy();
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchLegacyLocalCommands,
};