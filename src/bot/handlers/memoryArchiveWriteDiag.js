// src/bot/handlers/memoryArchiveWriteDiag.js
// STAGE 7.9.3 — archive write path with limits diagnostic
//
// Purpose:
// - test MemoryService.archiveMessage() through real runtime facade
// - verify bounded raw archive write
// - verify archive metadata separation from confirmed memory and digest memory
// - verify archive row is not returned by normal MemoryService.context()
//
// IMPORTANT:
// - This diagnostic writes ONE controlled archive diagnostic row.
// - No DB schema changes.
// - No direct SQL in this handler.
// - No AI logic.
// - No prompt injection.

import MemoryService from "../../core/MemoryService.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function shortJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch (_) {
    return "{}";
  }
}

function contextContainsNeedle(context, needle) {
  if (!context || !Array.isArray(context.memories)) return false;
  return context.memories.some((item) => safeStr(item?.content).includes(needle));
}

export async function handleMemoryArchiveWriteDiag({
  bot,
  chatId,
  chatIdStr = null,
  globalUserId = null,
  logger = console,
} = {}) {
  const effectiveChatId = safeStr(chatIdStr || chatId).trim();

  if (!bot || !chatId) {
    return {
      ok: false,
      reason: "missing_bot_or_chatId",
    };
  }

  if (!effectiveChatId) {
    await bot.sendMessage(chatId, "⚠️ memory archive write diag: missing chatId");
    return {
      ok: false,
      reason: "missing_chatId",
    };
  }

  const memoryService = new MemoryService({ logger });
  await memoryService.init();

  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8);
  const needle = `diag_archive_write_${stamp}_${randomPart}`;
  const longContent = `${needle} ${"x".repeat(320)}`;
  const maxChars = 120;

  const archive = await memoryService.archiveMessage({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    role: "user",
    content: longContent,
    transport: "telegram",
    metadata: {
      source: "memory_archive_write_diag",
      diagnostic: true,
      stage: "7.9.3",
    },
    schemaVersion: 1,
    maxChars,
  });

  const context = await memoryService.context({
    chatId: effectiveChatId,
    globalUserId: globalUserId || null,
    limit: 20,
  });

  const writeOk =
    archive?.ok === true &&
    archive?.stored === true &&
    archive?.reason === "archive_message_saved";
  const boundedOk =
    archive?.truncated === true &&
    Number(archive?.size || 0) <= maxChars &&
    Number(archive?.metadata?.archiveMaxChars || 0) === maxChars;
  const metadataOk =
    archive?.metadata?.memoryLayer === "raw_dialogue_archive" &&
    archive?.metadata?.archiveKind === "raw_dialogue" &&
    archive?.metadata?.memoryType === "archive" &&
    archive?.metadata?.promptFacing === false &&
    archive?.metadata?.rawPromptInjectionAllowed === false &&
    archive?.metadata?.confirmedMemory === false &&
    archive?.metadata?.digestMemory === false;
  const contextOk =
    context?.enabled === true &&
    contextContainsNeedle(context, needle) === false;
  const safetyOk =
    archive?.promptFacing === false &&
    archive?.rawPromptInjectionAllowed === false &&
    archive?.confirmedMemory === false &&
    archive?.digestMemory === false;

  const validationOk = writeOk && boundedOk && metadataOk && contextOk && safetyOk;

  const lines = [];
  lines.push("🧪 MEMORY ARCHIVE WRITE DIAG");
  lines.push(`validation: ${validationOk ? "OK" : "FAILED"}`);
  lines.push(`chat_id: ${effectiveChatId}`);
  lines.push(`globalUserId: ${globalUserId || "NULL"}`);
  lines.push(`needle: ${needle}`);
  lines.push(`maxChars: ${maxChars}`);
  lines.push("");
  lines.push(
    `1) write: ok=${String(archive?.ok === true)} stored=${String(archive?.stored === true)} reason=${archive?.reason || "-"} check=${String(writeOk)}`
  );
  lines.push(
    `2) bounded: truncated=${String(archive?.truncated === true)} size=${Number(archive?.size || 0)} originalSize=${Number(archive?.originalSize || 0)} check=${String(boundedOk)}`
  );
  lines.push(
    `3) metadata: layer=${archive?.metadata?.memoryLayer || "-"} kind=${archive?.metadata?.archiveKind || "-"} memoryType=${archive?.metadata?.memoryType || "-"} check=${String(metadataOk)}`
  );
  lines.push(
    `4) context: enabled=${String(context?.enabled === true)} containsArchiveNeedle=${String(contextContainsNeedle(context, needle))} memories=${Number(context?.memories?.length || 0)} check=${String(contextOk)}`
  );
  lines.push(
    `5) safety: promptFacing=${String(archive?.promptFacing === true)} rawPromptInjectionAllowed=${String(archive?.rawPromptInjectionAllowed === true)} confirmedMemory=${String(archive?.confirmedMemory === true)} digestMemory=${String(archive?.digestMemory === true)} check=${String(safetyOk)}`
  );
  lines.push("");
  lines.push(
    `checks: write=${String(writeOk)} bounded=${String(boundedOk)} metadata=${String(metadataOk)} context=${String(contextOk)} safety=${String(safetyOk)}`
  );

  if (!validationOk) {
    lines.push("");
    lines.push("debug:");
    lines.push(`archive=${shortJson({ ok: archive?.ok, stored: archive?.stored, reason: archive?.reason, size: archive?.size, metadata: archive?.metadata })}`);
    lines.push(`context=${shortJson({ enabled: context?.enabled, memories: context?.memories?.length })}`);
  }

  await bot.sendMessage(chatId, lines.join("\n").slice(0, 3800));

  return {
    ok: validationOk,
    needle,
    archive,
    context: {
      enabled: context?.enabled === true,
      memories: context?.memories?.length || 0,
      containsArchiveNeedle: contextContainsNeedle(context, needle),
    },
    checks: {
      write: writeOk,
      bounded: boundedOk,
      metadata: metadataOk,
      context: contextOk,
      safety: safetyOk,
    },
  };
}

export default {
  handleMemoryArchiveWriteDiag,
};
