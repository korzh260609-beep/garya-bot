// src/bot/dispatchers/dispatchMemoryDiagnosticsCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

// ✅ STAGE 7 — Memory diagnostics (enforced pipeline)
import { MemoryDiagnosticsService } from "../../core/MemoryDiagnosticsService.js";
import MemoryService from "../../core/MemoryService.js";
import { ExplicitRememberCleanupService } from "../../core/ExplicitRememberCleanupService.js";

// ✅ Singleton service (safe: no side-effects)
const memoryDiagSvc = new MemoryDiagnosticsService();
const memoryService = new MemoryService();
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

function okMark(value) {
  return value ? "true ✅" : "false ⛔";
}

function safeReason(value) {
  const text = String(value || "—").replace(/\s+/g, " ").trim();
  return text.slice(0, 120) || "—";
}

function buildMonarchMemoryDiagText({
  chatIdStr,
  globalUserId = null,
  cols = {},
  status = {},
  diagnosticsStatus = {},
} = {}) {
  const archive = status?.archive || {};
  const digest = status?.topicDigest || {};
  const recall = status?.topicRecall || {};
  const rawGuard = status?.rawPromptGuard || {};
  const confirmedGuard = status?.confirmedGuard || {};
  const diagnostics = status?.diagnostics || {};
  const buffer = status?.buffer || {};

  const dbColumnsOk =
    cols.global_user_id === true &&
    cols.transport === true &&
    cols.metadata === true &&
    cols.schema_version === true;

  const coreOk =
    status.ok === true &&
    status.enabled === true &&
    status.hasDb === true &&
    status.hasChatAdapter === true &&
    status.hasLongTermRead === true &&
    status.hasWriteService === true &&
    status.hasArchiveService === true &&
    status.hasTopicDigestService === true &&
    status.hasRawPromptGuard === true &&
    status.hasConfirmedGuard === true &&
    status.hasMemoryDiagnosticsService === true;

  const archiveOk =
    archive.ok === true &&
    archive.storageActive === true &&
    archive.restoreCapable === true &&
    archive.promptFacing === false &&
    archive.rawPromptInjectionAllowed === false &&
    archive.confirmedMemory === false &&
    archive.digestMemory === false;

  const digestOk =
    digest.ok === true &&
    digest.storageActive === false &&
    digest.aiGenerationActive === false &&
    digest.restoreCapable === true &&
    digest.promptFacing === false &&
    digest.rawPromptInjectionAllowed === false &&
    digest.confirmedMemory === false &&
    digest.archiveMemory === false;

  const recallOk =
    recall.ok === true &&
    recall.promptFacing === false &&
    recall.rawArchivePromptAllowed === false &&
    recall.crossUserRecallAllowed === false &&
    recall.crossGroupRecallAllowed === false;

  const guardOk =
    rawGuard.ok === true &&
    confirmedGuard.ok === true;

  const diagnosticsServiceOk =
    diagnosticsStatus.ok !== false &&
    diagnosticsStatus.dbWrites === false &&
    diagnosticsStatus.dbReads === false &&
    diagnosticsStatus.aiLogic === false &&
    diagnosticsStatus.promptInjection === false;

  const diagnosticsAdvisoryOk =
    diagnostics &&
    diagnostics.summary &&
    diagnostics.summary.advisoryOnly === true;

  const diagnosticsOk = diagnosticsServiceOk && diagnosticsAdvisoryOk;
  const validationOk = dbColumnsOk && coreOk && archiveOk && digestOk && recallOk && guardOk && diagnosticsOk;

  const lines = [];
  lines.push("🧠 MEMORY MONARCH DIAG");
  lines.push(`validation: ${validationOk ? "OK" : "FAILED"}`);
  lines.push(`chat_id: ${chatIdStr || "—"}`);
  lines.push(`globalUserId: ${globalUserId || "NULL"}`);
  lines.push("");

  lines.push("1) core:");
  lines.push(`enabled: ${okMark(status.enabled === true)}`);
  lines.push(`mode: ${status.mode || "—"}`);
  lines.push(`backend: ${status.backend || "—"}`);
  lines.push(`contractVersion: ${status.contractVersion ?? "—"}`);
  lines.push(`hasDb: ${okMark(status.hasDb === true)}`);
  lines.push(`hasChatAdapter: ${okMark(status.hasChatAdapter === true)}`);
  lines.push(`hasLongTermRead: ${okMark(status.hasLongTermRead === true)}`);
  lines.push(`hasWriteService: ${okMark(status.hasWriteService === true)}`);
  lines.push(`hasArchiveService: ${okMark(status.hasArchiveService === true)}`);
  lines.push(`hasTopicDigestService: ${okMark(status.hasTopicDigestService === true)}`);
  lines.push(`hasRawPromptGuard: ${okMark(status.hasRawPromptGuard === true)}`);
  lines.push(`hasConfirmedGuard: ${okMark(status.hasConfirmedGuard === true)}`);
  lines.push(`check: ${okMark(coreOk)}`);
  lines.push("");

  lines.push("2) DB columns:");
  lines.push(`global_user_id: ${okMark(cols.global_user_id === true)}`);
  lines.push(`transport: ${okMark(cols.transport === true)}`);
  lines.push(`metadata: ${okMark(cols.metadata === true)}`);
  lines.push(`schema_version: ${okMark(cols.schema_version === true)}`);
  lines.push(`check: ${okMark(dbColumnsOk)}`);
  lines.push("");

  lines.push("3) archive layer:");
  lines.push(`storageActive: ${okMark(archive.storageActive === true)}`);
  lines.push(`restoreCapable: ${okMark(archive.restoreCapable === true)}`);
  lines.push(`promptFacing: ${okMark(archive.promptFacing === true)}`);
  lines.push(`rawPromptInjectionAllowed: ${okMark(archive.rawPromptInjectionAllowed === true)}`);
  lines.push(`reason: ${safeReason(archive.reason)}`);
  lines.push(`check: ${okMark(archiveOk)}`);
  lines.push("");

  lines.push("4) topic digest layer:");
  lines.push(`storageActive: ${okMark(digest.storageActive === true)}`);
  lines.push(`aiGenerationActive: ${okMark(digest.aiGenerationActive === true)}`);
  lines.push(`restoreCapable: ${okMark(digest.restoreCapable === true)}`);
  lines.push(`promptFacing: ${okMark(digest.promptFacing === true)}`);
  lines.push(`rawPromptInjectionAllowed: ${okMark(digest.rawPromptInjectionAllowed === true)}`);
  lines.push(`reason: ${safeReason(digest.reason)}`);
  lines.push(`check: ${okMark(digestOk)}`);
  lines.push("");

  lines.push("5) recall / guards:");
  lines.push(`topicRecallPromptFacing: ${okMark(recall.promptFacing === true)}`);
  lines.push(`topicRecallRawArchivePromptAllowed: ${okMark(recall.rawArchivePromptAllowed === true)}`);
  lines.push(`topicRecallCrossUserAllowed: ${okMark(recall.crossUserRecallAllowed === true)}`);
  lines.push(`topicRecallCrossGroupAllowed: ${okMark(recall.crossGroupRecallAllowed === true)}`);
  lines.push(`rawPromptGuard: ${okMark(rawGuard.ok === true)}`);
  lines.push(`confirmedGuard: ${okMark(confirmedGuard.ok === true)}`);
  lines.push(`check: ${okMark(recallOk && guardOk)}`);
  lines.push("");

  lines.push("6) diagnostics / buffer:");
  lines.push(`diagnosticsService: ${okMark(diagnosticsServiceOk)}`);
  lines.push(`safetyDiagnosticsAdvisory: ${okMark(diagnosticsAdvisoryOk)}`);
  lines.push(`safetyDiagnosticsValidation: ${diagnostics?.summary?.validation || "—"}`);
  lines.push(`bufferEnabled: ${String(buffer.enabled === true)}`);
  lines.push(`bufferQueueSize: ${buffer.queueSize ?? buffer.size ?? "—"}`);
  lines.push("");

  lines.push(
    `checks: core=${String(coreOk)} db=${String(dbColumnsOk)} archive=${String(archiveOk)} digest=${String(digestOk)} recall=${String(recallOk)} guards=${String(guardOk)} diagnostics=${String(diagnosticsOk)}`
  );

  return lines.join("\n").slice(0, 3800);
}

export async function dispatchMemoryDiagnosticsCommands({ cmd0, ctx, reply }) {
  const { chatIdStr } = ctx;

  switch (cmd0) {
    case "/memory_monarch_diag": {
      const globalUserId = ctx?.user?.global_user_id ?? null;
      const cols = await memoryDiagSvc.getChatMemoryV2Columns();
      const status = await memoryService.status();
      const diagnosticsStatus = await memoryService.memoryDiagnosticsStatus();

      const text = buildMonarchMemoryDiagText({
        chatIdStr,
        globalUserId,
        cols,
        status,
        diagnosticsStatus,
      });

      await reply(text, { cmd: cmd0, handler: "commandDispatcher" });
      return { handled: true };
    }

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

    case "/memory_prompt_bridge": {
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

      const text = await memoryDiagSvc.memoryPromptBridge({
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