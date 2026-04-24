// src/bot/dispatchers/dispatchProjectMemoryCommands.js
// ============================================================================
// PROJECT MEMORY COMMANDS DISPATCHER
// Purpose:
// - route Project Memory command groups
// - keep Telegram transport thin
// - keep business logic inside handlers/services, not dispatcher
// - delegate basic/session/confirmed command groups to dedicated dispatchers
// ============================================================================

import { dispatchProjectMemoryBasicCommands } from "./dispatchProjectMemoryBasicCommands.js";
import { dispatchProjectMemorySessionCommands } from "./dispatchProjectMemorySessionCommands.js";
import { dispatchProjectMemoryConfirmedCommands } from "./dispatchProjectMemoryConfirmedCommands.js";

export async function dispatchProjectMemoryCommands({ cmd0, ctx, reply }) {
  const basicHandled = await dispatchProjectMemoryBasicCommands({
    cmd0,
    ctx,
    reply,
  });

  if (basicHandled?.handled) {
    return basicHandled;
  }

  const sessionHandled = await dispatchProjectMemorySessionCommands({
    cmd0,
    ctx,
    reply,
  });

  if (sessionHandled?.handled) {
    return sessionHandled;
  }

  const confirmedHandled = await dispatchProjectMemoryConfirmedCommands({
    cmd0,
    ctx,
    reply,
  });

  if (confirmedHandled?.handled) {
    return confirmedHandled;
  }

  return { handled: false };
}

export default {
  dispatchProjectMemoryCommands,
};