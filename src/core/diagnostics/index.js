// src/core/diagnostics/index.js
// STAGE 7B — diagnostics registry skeleton
// IMPORTANT:
// - skeleton only
// - no production logic moved yet

import { handleChatMessagesDiag } from "./chatMessagesDiag.js";

const DIAGNOSTIC_HANDLERS = {
  "/chat_messages_diag": handleChatMessagesDiag,
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