// src/bot/dispatchers/dispatchMemoryDiagnosticsCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

// ✅ STAGE 7 — Memory diagnostics (enforced pipeline)
import { MemoryDiagnosticsService } from "../../core/MemoryDiagnosticsService.js";
import { ExplicitRememberCleanupService } from "../../core/ExplicitRememberCleanupService.js";

// ✅ Singleton service (safe: no side-effects)
const memoryDiagSvc = new MemoryDiagnosticsService();
const explicitRememberCleanupSvc = new ExplicitRememberCleanupService();

export async function dispatchMemoryDiagnosticsCommands({ cmd0, ctx, reply }) {
  const { chatIdStr } = ctx;

  switch (cmd0) {
    case "/memory_status": {
      const cols = await memoryDiagSvc.getChatMemoryV2Columns();
      await reply(
        [
          "🧪 MEMORY STATUS",
          `global_user_id: ${cols.global_user_id ? "true ✅" : "false ⛔"}`,
          `transport: ${cols.transport ? "true ✅" : "false ⛔"}`,
          `metadata: ${cols.metadata ? "true ✅" : "false ⛔"}`,
          `schema_version: ${cols.schema_version ? "true ✅" : "false ⛔"}`,
        ].join("\n"),
        { cmd: cmd0, handler: "commandDispatcher" }
      );
      return { handled: true };
    }

    case "/memory_diag": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const text = await memoryDiagSvc.memoryDiag({ chatIdStr, globalUserId });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_integrity": {
      const text = await memoryDiagSvc.memoryIntegrity({ chatIdStr });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_backfill": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const limitStr = String(ctx?.rest || "").trim();
      const limit = limitStr ? Number(limitStr) : 200;
      const text = await memoryDiagSvc.memoryBackfill({ chatIdStr, globalUserId, limit });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_user_chats": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const text = await memoryDiagSvc.memoryUserChats({ globalUserId });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_longterm_diag": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const text = await memoryDiagSvc.memoryLongTermDiag({ chatIdStr, globalUserId });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_type_stats": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const text = await memoryDiagSvc.memoryTypeStats({ chatIdStr, globalUserId });
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_reclassify_explicit": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const rest = String(ctx?.rest || "").trim();

      // Supported:
      // /memory_reclassify_explicit
      // /memory_reclassify_explicit 150
      // /memory_reclassify_explicit apply
      // /memory_reclassify_explicit apply 150
      const parts = rest ? rest.split(/\s+/).filter(Boolean) : [];

      let dryRun = true;
      let limit = 100;

      for (const part of parts) {
        const p = String(part || "").trim().toLowerCase();

        if (p === "apply" || p === "--apply") {
          dryRun = false;
          continue;
        }

        if (/^\d+$/.test(p)) {
          limit = Number(p);
        }
      }

      const result = await explicitRememberCleanupSvc.reclassifyLegacyExplicitRemember({
        chatIdStr,
        globalUserId,
        limit,
        dryRun,
      });

      const text = explicitRememberCleanupSvc.formatResult(result);
      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}