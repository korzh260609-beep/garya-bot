// src/core/diagnostics/index.js
// STAGE 7B — diagnostics registry skeleton

import { handleChatMessagesDiag } from "./chatMessagesDiag.js";
import { handleDbDiag } from "./dbDiag.js";
import { handleCoreDiag } from "./coreDiag.js";
import { handleTransportDiag } from "./transportDiag.js";
import { handlePipelineDiag } from "./pipelineDiag.js";
import { handleSystemDiag } from "./systemDiag.js";
import { handleAllDiag } from "./allDiag.js";
import { handleHealthDiag } from "./healthDiag.js";
import { handleWatchDiag } from "./watchDiag.js";
import { handleDiagScheduler } from "./diagScheduler.js";
import { handleHealthSnapshotDiag } from "./healthSnapshotDiag.js";

const DIAGNOSTIC_HANDLERS = {
  "/chat_messages_diag": handleChatMessagesDiag,
  "/diag_db": handleDbDiag,
  "/diag_core": handleCoreDiag,
  "/diag_transport": handleTransportDiag,
  "/diag_pipeline": handlePipelineDiag,
  "/diag_system": handleSystemDiag,
  "/diag_all": handleAllDiag,
  "/diag_health": handleHealthDiag,
  "/diag_watch": handleWatchDiag,
  "/diag_scheduler": handleDiagScheduler,
  "/diag_health_snapshot": handleHealthSnapshotDiag,
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