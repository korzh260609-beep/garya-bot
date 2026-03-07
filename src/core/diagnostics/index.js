// src/core/diagnostics/index.js
// STAGE 7B — diagnostics registry

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
import { handleDiagRetention } from "./diagRetention.js";

// 7B.8
import { handleDiagChatMeta } from "./diagChatMeta.js";

const DIAGNOSTIC_HANDLERS = {

  // chat history
  "/chat_messages_diag": handleChatMessagesDiag,

  // system diagnostics
  "/diag_db": handleDbDiag,
  "/diag_core": handleCoreDiag,
  "/diag_transport": handleTransportDiag,
  "/diag_pipeline": handlePipelineDiag,
  "/diag_system": handleSystemDiag,
  "/diag_all": handleAllDiag,

  // health
  "/diag_health": handleHealthDiag,
  "/diag_watch": handleWatchDiag,
  "/diag_scheduler": handleDiagScheduler,
  "/diag_health_snapshot": handleHealthSnapshotDiag,

  // retention
  "/diag_retention": handleDiagRetention,

  // chat registry
  "/diag_chat_meta": handleDiagChatMeta,
};

export async function dispatchDiagnosticCommand(ctx = {}) {

  const cmdBase = String(ctx?.cmdBase || "");
  const handler = DIAGNOSTIC_HANDLERS[cmdBase];

  if (!handler) {
    return { handled: false };
  }

  try {
    return await handler(ctx);
  } catch (e) {

    console.error("dispatchDiagnosticCommand error:", {
      cmdBase,
      error: e?.message || e,
    });

    try {
      if (typeof ctx?.replyAndLog === "function") {
        await ctx.replyAndLog(
          "⚠️ Diagnostic command failed. Check logs.",
          { cmd: cmdBase, event: "diag_error" }
        );
      }
    } catch {}

    return {
      handled: true,
      ok: false,
      cmdBase,
      reason: "diag_error",
    };
  }
}

export { DIAGNOSTIC_HANDLERS };

export default dispatchDiagnosticCommand;