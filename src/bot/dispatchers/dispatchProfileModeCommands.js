// src/bot/dispatchers/dispatchProfileModeCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.
//
// INTERFACE MODE MARKER:
// - This file belongs to Technical Mode.
// - It routes explicit slash commands for profile/mode inspection or settings.
// - It must not be treated as Human Mode / normal SG intelligence.
// - Human Mode profile/mode behavior must go through meaning/context/capability selection.
// - Keep temporarily for diagnostics/backward compatibility.

import { handleProfile } from "../handlers/profile.js";
import { handleMode } from "../handlers/mode.js";

export async function dispatchProfileModeCommands({ cmd0, ctx }) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/profile":
    case "/me":
    case "/whoami": {
      await handleProfile({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
      });
      return { handled: true };
    }

    case "/mode": {
      await handleMode({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        getAnswerMode: ctx.getAnswerMode,
        setAnswerMode: ctx.setAnswerMode,
        globalUserId: ctx.user?.global_user_id ?? null,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}