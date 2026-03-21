// src/bot/dispatchers/dispatchMemoryDiagnosticsCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

// ✅ STAGE 7 — Memory diagnostics (enforced pipeline)
import { MemoryDiagnosticsService } from "../../core/MemoryDiagnosticsService.js";
import { ExplicitRememberCleanupService } from "../../core/ExplicitRememberCleanupService.js";

// ✅ Singleton service (safe: no side-effects)
const memoryDiagSvc = new MemoryDiagnosticsService();
const explicitRememberCleanupSvc = new ExplicitRememberCleanupService();

function parseSelectorArgs(restRaw = "") {
  const rest = String(restRaw || "").trim();
  const parts = rest ? rest.split(/\s+/).filter(Boolean) : [];

  const rememberTypes = [];
  const rememberKeys = [];

  let perTypeLimit = 3;
  let perKeyLimit = 3;
  let totalLimit = 12;
  let header = "LONG_TERM_MEMORY";
  let maxItems = 12;
  let maxValueLength = 240;

  for (const rawPart of parts) {
    const part = String(rawPart || "").trim();
    if (!part) continue;

    const lower = part.toLowerCase();

    if (lower.startsWith("type=")) {
      const value = part.slice(5).trim();
      if (value) {
        const list = value
          .split(",")
          .map((x) => String(x || "").trim())
          .filter(Boolean);
        rememberTypes.push(...list);
      }
      continue;
    }

    if (lower.startsWith("key=")) {
      const value = part.slice(4).trim();
      if (value) {
        const list = value
          .split(",")
          .map((x) => String(x || "").trim())
          .filter(Boolean);
        rememberKeys.push(...list);
      }
      continue;
    }

    if (lower.startsWith("pertype=")) {
      const value = part.slice(8).trim();
      if (/^\d+$/.test(value)) perTypeLimit = Number(value);
      continue;
    }

    if (lower.startsWith("perkey=")) {
      const value = part.slice(7).trim();
      if (/^\d+$/.test(value)) perKeyLimit = Number(value);
      continue;
    }

    if (lower.startsWith("total=")) {
      const value = part.slice(6).trim();
      if (/^\d+$/.test(value)) totalLimit = Number(value);
      continue;
    }

    if (lower.startsWith("header=")) {
      const value = part.slice(7).trim();
      if (value) header = value;
      continue;
    }

    if (lower.startsWith("maxitems=")) {
      const value = part.slice(9).trim();
      if (/^\d+$/.test(value)) maxItems = Number(value);
      continue;
    }

    if (lower.startsWith("maxvaluelen=")) {
      const value = part.slice(12).trim();
      if (/^\d+$/.test(value)) maxValueLength = Number(value);
      continue;
    }
  }

  return {
    rememberTypes,
    rememberKeys,
    perTypeLimit,
    perKeyLimit,
    totalLimit,
    header,
    maxItems,
    maxValueLength,
  };
}

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

    case "/memory_fetch_type": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const rest = String(ctx?.rest || "").trim();
      const parts = rest ? rest.split(/\s+/).filter(Boolean) : [];

      const rememberType = parts[0] ? String(parts[0]).trim() : "";
      const limit = parts[1] && /^\d+$/.test(parts[1]) ? Number(parts[1]) : 10;

      const text = await memoryDiagSvc.memoryFetchByType({
        chatIdStr,
        globalUserId,
        rememberType,
        limit,
      });

      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_fetch_key": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const rest = String(ctx?.rest || "").trim();
      const parts = rest ? rest.split(/\s+/).filter(Boolean) : [];

      const rememberKey = parts[0] ? String(parts[0]).trim() : "";
      const limit = parts[1] && /^\d+$/.test(parts[1]) ? Number(parts[1]) : 10;

      const text = await memoryDiagSvc.memoryFetchByKey({
        chatIdStr,
        globalUserId,
        rememberKey,
        limit,
      });

      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_summary_service": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const rest = String(ctx?.rest || "").trim();
      const limit = /^\d+$/.test(rest) ? Number(rest) : 20;

      const text = await memoryDiagSvc.memorySummaryViaService({
        chatIdStr,
        globalUserId,
        limit,
      });

      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_select_context": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const {
        rememberTypes,
        rememberKeys,
        perTypeLimit,
        perKeyLimit,
        totalLimit,
      } = parseSelectorArgs(ctx?.rest || "");

      const text = await memoryDiagSvc.memorySelectContext({
        chatIdStr,
        globalUserId,
        rememberTypes,
        rememberKeys,
        perTypeLimit,
        perKeyLimit,
        totalLimit,
      });

      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

    case "/memory_format_context": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const {
        rememberTypes,
        rememberKeys,
        perTypeLimit,
        perKeyLimit,
        totalLimit,
        header,
        maxItems,
        maxValueLength,
      } = parseSelectorArgs(ctx?.rest || "");

      const text = await memoryDiagSvc.memoryFormatSelectedContext({
        chatIdStr,
        globalUserId,
        rememberTypes,
        rememberKeys,
        perTypeLimit,
        perKeyLimit,
        totalLimit,
        header,
        maxItems,
        maxValueLength,
      });

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