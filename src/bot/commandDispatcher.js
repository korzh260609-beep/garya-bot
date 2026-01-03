// src/bot/commandDispatcher.js
// SKELETON ONLY: central command dispatcher.
// IMPORTANT: no business logic here (yet). We will move switch/cases here 1:1 later.

export async function dispatchCommand(cmd, ctx) {
  // ctx must contain everything messageRouter currently has in scope:
  // { bot, msg, chatId, chatIdStr, senderIdStr, userRole, userPlan, bypass, access, user, requirePermOrReply, ... }
  // For now we keep it as a placeholder to avoid accidental logic changes.

  switch (cmd) {
    default:
      // Not handled here yet. Caller decides what to do (e.g., "unknown command" message).
      return { handled: false };
  }
}

