// src/core/diagnostics/index.js
// STAGE 7B — diagnostics registry skeleton

import { handleChatMessagesDiag } from "./chatMessagesDiag.js";
import { handleDbDiag } from "./dbDiag.js";
import { handleCoreDiag } from "./coreDiag.js";
import { handleTransportDiag } from "./transportDiag.js";

const DIAGNOSTIC_HANDLERS = {
  "/chat_messages_diag": handleChatMessagesDiag,
  "/diag_db": handleDbDiag,
  "/diag_core": handleCoreDiag,
  "/diag_transport": handleTransportDiag,
};

export async function dispatchDiagnosticCommand(ctx = {}) {
  const cmdBase = String(ctx?.cmdBase || "");
  const handler = DIAGNOSTIC_HANDLERS[cmdBase];

  if (!handler) {
    return { handled: false };
  }

  return handler(ctx);
}

export { DIAGNOSTIC_HANDLERS };
export default dispatchDiagnosticCommand;